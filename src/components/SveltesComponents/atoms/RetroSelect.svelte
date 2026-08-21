<script lang="ts">
    import { onMount } from 'svelte';

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
    let selectContainer: HTMLDivElement | null = null;

    let selectedOption = $derived(
        options.find(o => o.value === value)
    );

    function toggleOpen() {
        isOpen = !isOpen;
    }

    function selectItem(opt: Option) {
        value = opt.value;
        isOpen = false;
        onchange?.(opt.value);
    }

    onMount(() => {
        function handleClickOutside(e: MouseEvent) {
            if (selectContainer && !selectContainer.contains(e.target as Node)) {
                isOpen = false;
            }
        }
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    });
</script>

<div class="flex flex-col gap-1 w-full font-mono relative {isOpen ? 'z-[100]' : 'z-10'}" bind:this={selectContainer}>
    {#if label}
        <span class="text-xs font-bold uppercase tracking-wider text-black">{label}</span>
    {/if}

    <!-- Trigger Button -->
    <button 
        type="button"
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

    <!-- Custom Retro Dropdown Menu (Z-index garanti au-dessus de la table) -->
    {#if isOpen}
        <div class="absolute top-full left-0 right-0 z-[100] mt-1 border-2 border-black bg-white shadow-[6px_6px_0px_0px_#000] max-h-60 overflow-y-auto font-mono text-xs animate-in fade-in duration-100">
            {#each options as opt}
                {@const isSelected = opt.value === value}
                <button
                    type="button"
                    onclick={() => selectItem(opt)}
                    class="w-full px-3 py-2 text-left font-bold flex items-center justify-between border-b border-black/10 last:border-b-0 cursor-pointer transition-colors {isSelected ? 'bg-[#D4E2FD] text-black font-black' : 'hover:bg-[#FFE600] text-black'}"
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
