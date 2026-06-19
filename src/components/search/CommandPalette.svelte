<script lang="ts">
  import { BASE } from "../../config.ts";
  import type { Snippet } from "svelte";

  import { fade, slide } from "svelte/transition";
  import type { Pagefind } from "vite-plugin-pagefind/types";
  import { showSearch } from "./CommandPaletteStore";

  type SearchResult = { title: string; content: string; href: string };

  let {
    showResults = $bindable(true),
    placeholder = "Search...",
    results = $bindable([
      {
        title: "Title",
        content:
          "This is some longer content that will probably have to be cut at some point, because it just wont fit but such is life, what can you do? nothing. i mean i guess you could scroll? but that would look ugly",
        href: "/",
      },
      { title: "Title", content: "Content", href: "/" },
    ]),
    noResults = "No results found",
    value = $bindable(""),
    icon,
    children,
  }: {
    showResults?: boolean;
    placeholder?: string;
    results?: SearchResult[];
    noResults?: string;
    value?: string;
    icon?: Snippet;
    children?: Snippet;
  } = $props();

  let currentSelection = $state(0);

  let pagefind: Pagefind | undefined;
  let input = $state<HTMLInputElement | undefined>(undefined);

  const search = async () => {
    if (!pagefind || value.trim() === "") return;

    const pagefindResults = (await pagefind.debouncedSearch(value)).results;

    showResults = true;
    results = [];

    const newResults: SearchResult[] = [];

    for (let i = 0; i < pagefindResults.length && i < 5; i++) {
      const result = await pagefindResults[i].data();

      let excerpt = result.excerpt;
      // replace <mark> tags with <span class="bg-pink-600/10">
      excerpt = excerpt.replaceAll(
        "<mark>",
        '<span class="bg-accent-500/20 rounded-md p-0.5">',
      );
      excerpt = excerpt.replaceAll("</mark>", "</span>");

      newResults[i] = {
        title: result.meta.title,
        content: excerpt,
        href: result.url,
      };
    }

    results = Object.values(newResults);
  };

  export const show = () => {
    $showSearch = true;
    setTimeout(() => input?.focus(), 200);
  };

  async function setupSearch() {
    try {
      // @ts-ignore
      pagefind = await import(
        /* @vite-ignore */ BASE + "/pagefind/pagefind.js"
      );
      // If there is already a query before pagefind is even loaded, search immediately.
      if (value.trim() !== "") await search();
    } catch (error) {
      console.error("Pagefind module not found, will retry after build");
    }
  }

  setupSearch();

  $effect(() => {
    if (value.trim() === "") {
      results = [];
      showResults = false;
      return;
    }

    search();
  });

  $effect(() => {
    if ($showSearch) {
      currentSelection = 0;
      setTimeout(() => input?.focus(), 200);
      return;
    }

    value = "";
  });
</script>

<svelte:window
  onkeydown={(event) => {
    // show/hide on command + k
    if (event.key === "k" && event.metaKey) {
      $showSearch = !$showSearch;
      event.preventDefault();
    }

    // close on escape
    if (event.key === "Escape" && $showSearch) {
      $showSearch = false;
    }
  }}
/>

{#if $showSearch}
  <div
    class="relative z-50"
    role="dialog"
    aria-modal="true"
    transition:fade={{ duration: 100 }}
  >
    <div class="fixed inset-0 z-10 w-screen overflow-y-auto p-4 pt-20 md:p-20">
      <button
        onclick={() => ($showSearch = false)}
        class="fixed inset-0 bg-base-500/20 dark:bg-base-950/70 transition-opacity z-0 cursor-default backdrop-blur-sm"
        aria-label="hide search"
      ></button>

      <div
        class="relative z-10 mx-auto max-w-xl transform divide-y divide-base-100 dark:divide-white/10 overflow-hidden rounded-xl bg-white dark:bg-base-900 shadow-2xl ring-1 ring-black dark:ring-white/20 ring-opacity-5 transition-all"
      >
        <div class="relative flex grow items-stretch focus-within:z-10">
          <input
            onkeydown={(event) => {
              if (event.key === "Enter") {
                if (value.trim() === "") {
                  $showSearch = false;
                }

                // navigate to current selection
                if (
                  currentSelection >= 0 &&
                  currentSelection < results.length
                ) {
                  window.location.href = results[currentSelection].href;
                } else {
                  $showSearch = false;
                }
              }

              // on arrow down
              if (event.key === "ArrowDown") {
                currentSelection++;
                if (currentSelection >= results.length) currentSelection = 0;
              }
              // on arrow up
              if (event.key === "ArrowUp") {
                currentSelection--;
                if (currentSelection < 0) currentSelection = results.length - 1;
              }
            }}
            type="text"
            class="h-12 w-full border-0 bg-transparent pl-4 pr-4 text-base-900 dark:text-base-100 placeholder:text-base-400 focus:ring-0 sm:text-sm"
            {placeholder}
            role="combobox"
            aria-expanded="false"
            aria-controls="options"
            bind:value
            bind:this={input}
          />
          <button
            onclick={() => {
              search();
            }}
            type="button"
            class="relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold text-base-900 dark:bg-base-900 dark:hover:bg-base-800 hover:bg-base-50"
          >
            {#if icon}
              {@render icon()}
            {:else}
              <svg
                class=" h-5 w-5 text-base-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clip-rule="evenodd"
                />
              </svg>
            {/if}
            {@render children?.()}
          </button>
        </div>

        <!-- Results, show/hide based on command palette state -->
        {#if showResults && value.trim() !== ""}
          <div transition:slide={{ duration: 100 }}>
            {#if results.length > 0}
              <div
                class="scroll-py-2 overflow-y-auto text-sm text-base-800 dark:text-base-200 divide-y divide-base-100 dark:divide-white/5 flex flex-col"
              >
                <!-- Active: "bg-indigo-600 text-white" -->
                {#each results as result, i}
                  <a
                    href={result.href}
                    class="w-full {currentSelection === i
                      ? 'bg-white/5'
                      : 'hover:bg-white/5'} select-none px-4 py-2 text-left"
                  >
                    <div class="font-semibold">
                      {result.title}
                    </div>
                    <div class="text-xs mt-2 line-clamp-2">
                      {@html result.content}
                    </div>
                  </a>
                {/each}
              </div>
            {:else}
              <!-- Empty state, show/hide based on command palette state -->
              <p class="p-4 text-sm text-base-500 dark:text-base-400">
                {noResults}
              </p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
