<script>
    import SpecFileContent from "./SpecFileContent.svelte";

    export let title;
    export let content;

    let slashes = title.split("/");
    let HeadingTag = "h" + (slashes.length+1)/* + "  class=text-gradient"*/;
</script>

<li>
    <svelte:element this={HeadingTag}>
        <small>{title.substring(0,title.lastIndexOf("/"))}</small>
        {title.substring(title.lastIndexOf("/"))}
    </svelte:element>
    {#each Object.keys(content) as file}
        {@const formattedFileName = file.substring(1, file.length-3)}
        <SpecFileContent formattedFileName={formattedFileName} fileContent={content[file]}></SpecFileContent>
    {/each}
</li>
<style>
    h1,h2,h3,h4,h5,h6 {
		background-image: var(--accent-gradient);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-size: 400%;
		background-position: 0%;
	}
</style>