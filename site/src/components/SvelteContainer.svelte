<script>
    export let estree = {};

    import SpecDescription from "./SpecDescription.svelte";
    import hljs from "highlight.js";
    import javascript from "highlight.js/lib/languages/javascript";
    import "highlight.js/styles/github-dark.css";
    import { onMount,tick } from "svelte";

    hljs.registerLanguage('js', javascript);
    let query = '';
    let acceptableKeys = Object.keys(estree);
    async function search() {
        if(query.trim() === ''){
            var currentURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.pushState({ path: currentURL }, '', currentURL);

            acceptableKeys = Object.keys(estree);
        }else{
        window.history.pushState( {} , '', `?q=${query}` );
            acceptableKeys = [];
            Object.keys(estree).forEach(key => {
                if(key.toLowerCase().includes(query.toLowerCase())){
                    acceptableKeys.push(key);
                }
            });
        }
        await tick();
        hljs.highlightAll();
    }
    onMount(() => {
        query = new URL(window.location.href).searchParams.get('q') ?? '';
        if(query !== ''){
            search();
        }
        hljs.highlightAll();

    })
</script>

<input bind:value={query} class="searchInput" placeholder="Search..." on:input={search}>
{#if estree !== null && acceptableKeys.length !== 0}
    {#if query !== ''}
        <p class="no-margin"><code class="text-gradient">{acceptableKeys.length}</code> results found for <span class="text-gradient">{query}</span></p>
    {/if}
    {#each Object.keys(estree) as key}
        {#if acceptableKeys.includes(key)}
            {@const item = estree[key]}
            <SpecDescription title={key} content={item.content} mdn={item.mdn}/>
        {/if}
    {/each}
{:else}
    <h1><code class="text-gradient">0</code> results found for <code class="text-gradient">{query}</code></h1>
{/if}


<style>
    .searchInput{
        background: #0d1116;
        border: none;
        padding: 1rem 1rem;
        border-radius: 10px;
        color: white;
        margin: 0;
        font-family: 'Poppins', system-ui, sans-serif;
        font-size: 1.3rem;
        text-transform: capitalize;
        font-weight: 400;
    }
    .no-margin{
        margin: 0;
    }
</style>