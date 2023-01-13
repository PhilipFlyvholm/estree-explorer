const fs = require('fs');
const path = require('path');
const md = require("markdown").markdown;
const MarkdownIt = require('markdown-it');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const hljs = require('highlight.js/lib/core');
hljs.registerLanguage('js', require('highlight.js/lib/languages/javascript'));
hljs.registerLanguage('jsonc', require('highlight.js/lib/languages/json'));



const fullPath = path.join(__dirname, 'estree');
const ignore = ["LICENSE", "README.md", "deprecated.md", "governance.md", "stage3", "experimental"];

function findAllFilesInDir(dirPath) {
    let filesFound = [];
    let dir = fs.readdirSync(dirPath);
    for (const key in dir) {
        let file = dir[key];
        if (file.startsWith(".") || ignore.includes(file)){
            console.log("Ignoring file: ", file);
            continue;
        }
        const filePath = path.join(dirPath, file);
        let stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            let subDir = findAllFilesInDir(filePath);
            if (subDir.length == 0) continue;
            filesFound = filesFound.concat(subDir);
        } else {
            filesFound.push(filePath);
        }
    }
    return filesFound;
}

function readFileToString(filePath) {
    return fs.readFileSync(filePath).toString();
}

function peek(stack, n) {
    if (n > 0) return stack[n];
    else return stack[stack.length + n];
}

function parseMarkdown(file, filePath) {
    let stack = new Parser(file, filePath).parse();
    let depthStack = [];
    //Add depth to stack
    for (let i = 0; i < stack.length; i++) {
        const current = stack[i];
        if (depthStack.length == 0) {
            depthStack.push(current);
            continue;
        }
        const currentLevel = current.level;
        let lastInStack = peek(depthStack, -1);
        if (lastInStack.level < currentLevel) {
            insertChild(lastInStack, current);
        } else depthStack.push(current);
    }
    return depthStack;
}


function insertChild(current, child) {
    if (current.subSections.length === 0) {
        current.subSections.push(child);
    }
    let lastInStack = peek(current.subSections, -1);
    if (lastInStack.level < child.level) {
        insertChild(lastInStack, child);
    } else {
        current.subSections.push(child);
    }
}

class Parser {
    constructor(file, filePath) {
        this.file = file;
        this.filePath = filePath;
        this.stack = [];
        this.description = [];
        this.pos = 0;
        const md = new MarkdownIt();
        this.tree = md.parse(file, {});
        this.parse();
    }
    current = () => peek(this.stack, -1);

    parseInline = (inlineChildren) => {
        let text = "";
        inlineChildren.forEach(child => {
            switch (child.type) {
                case "text": {
                    text += child.content;
                    break;
                }
                case "link_open": {
                    let attrs = child.attrs.map(attr => attr[0] + "=" + attr[1]).join(" ");
                    text += `<a${attrs === "" ? "" : " " + attrs}>`;
                    break;
                }
                case "link_close": {
                    text += "</a>";
                    break;
                }
                case "code_inline": {
                    text += "<code>" + child.content + "</code>";
                    break;
                }
                case "strong_open": {
                    text += "<strong>";
                    break;
                }
                case "strong_close": {
                    text += "</strong>";
                    break;
                }
                case "em_open": {
                    text += "<em>";
                    break;
                }
                case "em_close": {
                    text += "</em>";
                    break;
                }
                case "softbreak": {
                    text += "<br/>"
                    break;
                }
                default: {
                    console.log("Unsupported child of inline", child.type);
                    text += child.content;
                    break;
                }
            }
        });
        return text;
    }
    parseParagrafInternal = () => {
        let paragraf = "";
        this.pos++;
        while ((this.tree.length > this.pos) && this.tree[this.pos].type != "paragraph_close") {
            switch (this.tree[this.pos].type) {
                case "inline":
                    paragraf += this.parseInline(this.tree[this.pos].children);
                    break;
                default:
                    console.log("Unsupported child of paragraf", this.tree[this.pos].type);
                    break;
            }
            this.pos++;
        }
        if(!paragraf.startsWith("<")) paragraf = `<p>${paragraf}</p>`;
        return paragraf;
    }
    parseParagraf = () => {
        const paragraf = this.parseParagrafInternal();
        if (this.stack.length === 0) {
            this.description.push(paragraf);
        } else {
            this.current().content.push(paragraf);
        }
    }
    parseHeading = (token) => {
        let title = "";
        this.pos++;
        while ((this.tree.length > this.pos) && this.tree[this.pos].type != "heading_close") {
            switch (this.tree[this.pos].type) {
                case "inline":
                    title += this.tree[this.pos].content;
                    break;
                case "heading_open": {
                    this.parseHeading(this.tree[this.pos]);
                    let subSection = this.stack.pop();
                    let current = this.stack.pop();
                    current.subSections.push(subSection);
                    this.stack.push(current);
                    break;
                }
                default:
                    console.log("Unsupported child of heading", this.tree[this.pos].type);
                    break;
            }
            this.pos++;
        }
        let level = Number(token.tag.substring(1));
        let section = {
            level: level,
            title: title,
            subSections: [],
            content: [],
            file: this.filePath
        }
        this.stack.push(section);
    }

    parseFence = (token) => {
        let lang = token.info ?? "unknown";
        let highlightedCode = hljs.highlight(token.content, {language: lang}).value;
        let code = `<pre><code class="language-${lang} hljs">${highlightedCode}</code></pre>`
        if (this.stack.length === 0) {
            this.description.push(code);
        } else {
            this.current().content.push(code);
        }
    }

    parseListInternal = (token) => {
        let content = `<${token.tag}>`;
        
        this.pos++;
        token = this.tree[this.pos];
        while ((this.tree.length > this.pos) && token.type != "bullet_list_close") {
            switch (token.type) {
                case "paragraph_open":
                    content += `${this.parseParagrafInternal()}`;
                    break;
                case "bullet_list_open":
                    content += this.parseListInternal(token)
                    break;
                case "list_item_open":
                    //Ignore
                    content += '<li>';
                    break;
                case "list_item_close":
                    content += '</li>';
                    break;
                default:
                    console.log("Unsupported child of list: ", token.type);
                    break;
            }
            this.pos++;
            token = this.tree[this.pos];
        }
        content += `</${token.tag}>`;
        
        return content;
    }
    parseList = (token) => {
        const content = this.parseListInternal(token);
        if (this.stack.length === 0) {
            this.description.push(content);
        } else {
            this.current().content.push(content);
        }
        return;
    }

    parse = () => {
        while (this.tree.length > this.pos) {
            const token = this.tree[this.pos];
            switch (token.type) {
                case "paragraph_open": {
                    this.parseParagraf();
                    break;
                }
                case "heading_open": {
                    this.parseHeading(token);
                    break;
                }
                case "fence":
                    this.parseFence(token);
                    break;
                case "bullet_list_open":
                    //Ignore
                    this.parseList(token);
                    break;
                default:
                    console.log("Not implemented", token.type);
                    break;
            }
            this.pos++;
        }
        return this.stack;
    }
}

function mergeKnownInfo(parsedFiles, parent = "", json = {}) {
    parsedFiles.forEach(md => {
        let name = parent === "" ? md.title : parent + "/" + md.title;
        if (md.content.length === 0) {
            if (md.subSections.length === 0) {
                return json;
            }
            return mergeKnownInfo(md.subSections, name, json);
        }
        if (json[name] && json[name][md.file]) {
            json[name][md.file].concat(md.content);
        } else if (json[name]) {
            json[name][md.file] = md.content;
        } else {
            json[name] = {};
            json[name][md.file] = md.content;
        }
        json = mergeKnownInfo(md.subSections, name, json);
    });
    return json;
}

async function getMDNLinks(sections) {
    // To skip this part then run: npm run generate -- --skip-mdn
    const skipMDN = process.argv.indexOf('--skip-mdn') !== -1;
    if(skipMDN) console.log("Skipping MDN..."); else console.log("Fetching from MDN");
    const total = Object.keys(sections).length;
    let i = 1;
    await Promise.all(Object.keys(sections).map(async (key) => {
        const val = sections[key];
        if(skipMDN){
            sections[key] = {content: val, mdn: {score: null, url: null}}
            return;
        }
        const areas = key.split("/");
        let url = new URL("https://developer.mozilla.org/api/v1/search");
        url.searchParams.set('q', areas[areas.length - 1]);
    
        const res = await fetch(url.toString());
        if(!res.ok) return;
        const result = await res.json();
        const documents = result.documents;
        const document = documents[0];
        const mdn_url = "https://developer.mozilla.org" + document.mdn_url;
        const score = document.score;
        sections[key] = {content: val, mdn: {score: score, url: mdn_url}}
        process.stdout.write(`\rProcessed ${i++} calls out of ${total}`);

    }));
    return sections;
}

async function main(){
    
    console.log("Finding files...");
    const filesFound = findAllFilesInDir(fullPath);
    console.log("Found these files: ", filesFound.toString());
    let parsedFiles = []
    //parsedFiles = parseMarkdown(readFileToString("./estree/es2015.md"), "/estree/es2015.md");
    
    filesFound.forEach(file => {
        let relativePath = file.substring(fullPath.length).replace(/\\/g, "/");
        let markdownJson = parseMarkdown(readFileToString(file), relativePath);
        parsedFiles = parsedFiles.concat(markdownJson);
    });
    
    
    let merged = mergeKnownInfo(parsedFiles);
    let mappedToMDN = await getMDNLinks(merged);
    fs.writeFileSync("./output/output.json", JSON.stringify(mappedToMDN));
}

main();
