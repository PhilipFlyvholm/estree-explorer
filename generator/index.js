const fs = require('fs');
const path = require('path');
const md = require("markdown").markdown;
const MarkdownIt = require('markdown-it');


const fullPath = path.join(__dirname, 'estree');
const ignore = ["LICENSE", "README.md", "deprecated.md", "governance.md", "stage3", "experimental"];

function findAllFilesInDir(dirPath) {
    let filesFound = [];
    let dir = fs.readdirSync(dirPath);
    for (const key in dir) {
        let file = dir[key];
        if (file.startsWith(".") || ignore.includes(file)) continue;
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

    parseParagraf = () => {
        let paragraf = "<p>";
        this.pos++;
        while ((this.tree.length <= this.pos) || this.tree[this.pos].type != "paragraph_close") {
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
        paragraf += "</p>";
        if (this.stack.length === 0) {
            this.description.push(paragraf);
        } else {
            this.current().content.push(paragraf);
        }

        //return;
    }
    parseHeading = (token) => {
        let title = "";
        this.pos++;
        while ((this.tree.length <= this.pos) || this.tree[this.pos].type != "heading_close") {
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
        let code = `<pre><code class="language-${lang}">${token.content}</code></pre>`
        if (this.stack.length === 0) {
            this.description.push(code);
        } else {
            this.current().content.push(code);
        }
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
                case "list_item_open":
                case "list_item_close":
                case "bullet_list_open":
                case "bullet_list_close":
                    //Ignore
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

const filesFound = findAllFilesInDir(fullPath);
let parsedFiles = []
//parsedFiles = parseMarkdown(readFileToString("./estree/es2015.md"), "/estree/es2015.md");

filesFound.forEach(file => {
    let relativePath = file.substring(fullPath.length).replace(/\\/g, "/");
    let markdownJson = parseMarkdown(readFileToString(file), relativePath);
    parsedFiles = parsedFiles.concat(markdownJson);
});

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

let merged = mergeKnownInfo(parsedFiles);
fs.writeFileSync("./output/output.json", JSON.stringify(merged));
