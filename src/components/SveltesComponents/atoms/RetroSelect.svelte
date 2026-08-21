<script lang="ts">
    import { onMount, tick } from 'svelte';

    interface Option {
        value: any;
        label: string;
        badge?: string;
    }

    interface Props {
        label?: string;
        options: Option[];
        value: any;
        placeholder?: string;
        onchange?: (val: any) => void;
    }

    let { label, options = [], value = $bindable(), placeholder = "Sélectionner...", onchange }: Props = $props();

    let isOpen = $state(false);
    let triggerBtn: HTMLButtonElement | null = null;
    let menuElement: HTMLDivElement | null = null;
    let coords = $state({ top: 0, left: 0, width: 0 });

    let selectedOption = $derived(
        options.find(o => o.value === value)
    );

    function updatePosition() {
        if (!triggerBtn) return;
        const rect = triggerBtn.getBoundingClientRect();
        coords = {
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width
        };
    }

    async function toggleOpen(e: MouseEvent) {
        e.stopPropagation();
        isOpen = !isOpen;
        if (isOpen) {
            updatePosition();
            await tick();
            updatePosition();
        }
    }

    function selectItem(opt: Option, e: MouseEvent) {
        e.stopPropagation();
        value = opt.value;
        isOpen = false;
        onchange?.(opt.value);
    }

    function portal(node: HTMLElement) {
        document.body.appendChild(node);
        return {
            destroy() {
                if (node.parentNode) node.parentNode.removeChild(node);
            }
        };
    }

    onMount(() => {
        function handleGlobalClick(e: MouseEvent) {
            const target = e.target as Node;
            if (triggerBtn && triggerBtn.contains(target)) return;
            if (menuElement && menuElement.contains(target)) return;
            isOpen = false;
        }

        function handleScrollOrResize() {
            if (isOpen) {
                updatePosition();
            }
        }

        window.addEventListener('click', handleGlobalClick);
        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);

        return () => {
            window.removeEventListener('click', handleGlobalClick);
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    });
</script>

<div class="flex flex-col gap-1 w-full font-mono relative">
    {#if label}
        <span class="text-xs font-bold uppercase tracking-wider text-black">{label}</span>
    {/if}

    <!-- Trigger Button -->
    <button 
        type="button"
        bind:this={triggerBtn}
        onclick={toggleOpen}
        class="border-2 border-black bg-white text-black font-mono text-xs font-bold px-3 py-2 shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:bg-[#F6F4EE] flex items-center justify-between gap-2 w-full text-left transition-all cursor-pointer {isOpen ? 'shadow-[4px_4px_0px_0px_#000] bg-white ring-1 ring-black' : ''}"
    >
        <span class="truncate">
            {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span class="text-[10px] font-mono transform transition-transform {isOpen ? 'rotate-180' : ''}">
            ▼
        </span>
    </button>

    <!-- Custom Retro Dropdown Menu téléporté au body pour survoler absolument tout -->
    {#if isOpen}
        <div 
            use:portal
            bind:this={menuElement}
            style="position: fixed; top: {coords.top}px; left: {coords.left}px; width: {coords.width}px; z-index: 99999;"
            class="border-2 border-black bg-white shadow-[6px_6px_0px_0px_#000] max-h-60 overflow-y-auto font-mono text-xs animate-in fade-in duration-100"
        >
            {#each options as opt}
                {@const isSelected = opt.value === value}
                <button
                    type="button"
                    onclick={(e) => selectItem(opt, e)}
                    class="w-full px-3 py-2.5 text-left font-bold flex items-center justify-between border-b border-black/10 last:border-b-0 cursor-pointer transition-colors {isSelected ? 'bg-[#D4E2FD] text-black font-black' : 'hover:bg-[#FFE600] text-black'}"
                >
                    <span class="truncate">{opt.label}</span>
                    {#if isSelected}
                        <span class="text-xs font-black">✓</span>
                    {/if}
                </button>
            {/each}
        </div>
    {/if}
</div>
