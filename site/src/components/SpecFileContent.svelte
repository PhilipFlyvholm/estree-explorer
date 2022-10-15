<script>
    
    export let formattedFileName;
    export let fileContent;
    

    // Ref: https://stackoverflow.com/a/3426956
    function hashCode(str) {
        // java String#hashCode
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return hash;
    }

    // Ref: https://stackoverflow.com/a/3426956
    function intToRGB(i) {
        var c = (i & 0x00ffffff).toString(16).toUpperCase();

        return "00000".substring(0, 6 - c.length) + c;
    }
    let pillColor =
        "background: #" + intToRGB(hashCode(formattedFileName)) + ";";
</script>

<div class="file">
    <p class="pill" style={pillColor}>{formattedFileName}</p>
    <div class="file-content">
        {#each fileContent as content}
            <div class="content-container">{@html content}</div>
        {/each}
    </div>
</div>

<style>
    .pill {
        border-radius: 100px;
        padding: 5px 10px;
        background: blue;
        display: inline-block;
        margin: 0;
        font-weight: boldsc;
        margin-top: 1rem;
        text-transform: uppercase;
    }
    .file {
        background: #1b1c1f;
        padding: 0.1rem 2rem;
        margin: 1rem 0;
        border-radius: 10px;
    }
    :global(code){
        border-radius: 15px;
    }
</style>
