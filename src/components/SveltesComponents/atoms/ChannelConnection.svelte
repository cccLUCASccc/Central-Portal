<script lang="ts">
  import { onMount } from "svelte";
  import { apiFetch } from "../../../lib/api";
  import { channels, type ChannelID } from "../../../lib/channels";
  import { readAuthResponse } from "../../../lib/channel-auth";

  let { channel, apiUrl }: { channel: ChannelID; apiUrl?: string } = $props();
  const definition = $derived(channels.find((item) => item.id === channel)!);
  let isLoading = $state(false);
  let error = $state("");
  let success = $state("");
  let ready = $state(false);
  const stateKey = $derived(`channel-oauth-state:${channel}`);

  function endpoint(action: "login" | "exchange") {
    if (!apiUrl) {
      throw new Error("L'adresse de Central-API est absente. Configurez API_URL (ou PUBLIC_API_URL) dans le portail, puis redémarrez-le.");
    }
    return `${apiUrl.replace(/\/+$/, "")}/api/channels/${channel}/auth/${action}`;
  }

  function showError(cause: unknown) {
    error = cause instanceof Error ? cause.message : String(cause);
    console.error(`Échec de connexion ${channel}:`, cause);
  }

  async function request(action: "login" | "exchange", body?: string) {
    const url = endpoint(action);
    let response: Response;
    try {
      response = await apiFetch(url, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(30000)
      });
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`Impossible de joindre Central-API ou de récupérer votre session.\n\nDétail : ${reason}\n\nVérifiez votre connexion réseau, l'adresse API_URL, la disponibilité du serveur et les autorisations CORS. Si votre session a expiré, reconnectez-vous au portail.`);
    }
    return readAuthResponse(response);
  }

  async function connect() {
    isLoading = true;
    error = "";
    success = "";
    try {
      const data = await request("login");
      if (typeof data.url !== "string") {
        throw new Error("Le serveur n'a pas fourni de lien d'autorisation. Vérifiez la configuration OAuth du canal.");
      }
      const url = new URL(data.url);
      const state = url.searchParams.get("state");
      if (url.protocol !== "https:" || url.hostname !== definition.authorizationHost || url.username || url.password || !state) {
        throw new Error("Le lien d'autorisation fourni par le serveur est invalide ou ne correspond pas au canal.");
      }
      sessionStorage.setItem(stateKey, state);
      window.location.assign(url.href);
    } catch (cause) {
      showError(cause);
      isLoading = false;
    }
  }

  async function callback(params: URLSearchParams) {
    isLoading = true;
    try {
      const state = params.get("state");
      const expected = sessionStorage.getItem(stateKey);
      if (!state || !expected || state !== expected) {
        throw new Error("Le retour du canal ne correspond pas à la connexion lancée dans cet onglet, ou l'autorisation a déjà été utilisée. Relancez la connexion depuis cette page.");
      }
      sessionStorage.removeItem(stateKey);
      if (params.has("error")) {
        throw new Error(`Le canal a refusé l'autorisation.\n\nCode : ${params.get("error")}\nExplication : ${params.get("error_description") || params.get("error_reason") || "Autorisation annulée ou permissions refusées."}\n\nVérifiez les permissions de l'application développeur, puis réessayez.`);
      }
      const code = params.get("code");
      if (!code) {
        throw new Error("Le canal n'a pas renvoyé de code d'autorisation. Relancez la connexion et acceptez les permissions demandées.");
      }
      const data = await request("exchange", JSON.stringify({ code, state }));
      if (typeof data.message !== "string") {
        throw new Error("Le serveur n'a pas confirmé l'enregistrement de la connexion. Consultez les journaux de Central-API avant de réessayer.");
      }
      success = data.message;
    } catch (cause) {
      showError(cause);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    ready = true;
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    if (["code", "state", "error", "error_description", "error_reason"].some((key) => params.has(key))) {
      for (const key of ["code", "state", "error", "error_description", "error_reason"]) {
        url.searchParams.delete(key);
      }
      window.history.replaceState({}, "", url.pathname + url.search);
      void callback(params);
    }
  });
</script>

<div class="space-y-4 font-mono">
  <button
    type="button"
    onclick={connect}
    disabled={!ready || isLoading}
    class="retro-btn bg-white px-4 py-2 text-xs font-black hover:bg-[#86E2D5] disabled:opacity-60"
  >
    {#if isLoading}
      <span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
      Connexion en cours…
    {:else}
      <span class="material-symbols-outlined text-[16px]" aria-hidden="true">link</span>
      Connexion {definition.name}
    {/if}
  </button>
  {#if error}
    <div role="alert" class="border-2 border-black bg-[#FFE2E2] p-5 text-sm shadow-[4px_4px_0px_0px_#000]">
      <h2 class="font-black">Échec de la connexion {definition.name}</h2>
      <p class="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed">{error}</p>
      <p class="mt-3 text-xs">Vous pouvez réessayer avec le bouton de connexion ci-dessus.</p>
    </div>
  {/if}
  {#if success}
    <div role="status" class="border-2 border-black bg-[#86E2D5] p-4 text-sm">
      {success}
    </div>
  {/if}
</div>
