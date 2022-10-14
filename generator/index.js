const fs = require('fs');
const path = require('path');
const md = require("markdown").markdown;

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
    const tree = md.parse(file);
    const description = []
    const stack = [];
    tree.forEach(element => {
        let type = element[0];
        switch (type) {
            case "header":
                //Start on new
                const level = element[1].level;
                let section = {
                    level: level,
                    title: element[2],
                    subSections: [],
                    content: [],
                    file: filePath
                }
                stack.push(section);
                break;
            case "para":
                for (let line = 1; line < element.length; line++) {
                    let text = element[line];
                    if (typeof text === "string") {
                        text = text.replace(/<!--.*-->/g, "");
                    }
                    const current = stack[stack.length - 1];
                    if (current) current.content.push(text);
                    else description.push(text);
                }
                break;
            case "m":
                //Who cares ;)
                break;
            default:
                if (!type) {
                    console.log("unkown element", element);
                }
                console.log(type, "not implemented yet");
                break;
        }
    });
    //console.log("Description", description);
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

//["D:\\Code\\estree-explorer\\estree\\es2019.md"]
const filesFound = findAllFilesInDir(fullPath);
let parsedFiles = []

filesFound.forEach(file => {
    let relativePath = file.substring(fullPath.length).replace(/\\/g, "/");
    let markdownJson = parseMarkdown(readFileToString(file), relativePath);
    parsedFiles = parsedFiles.concat(markdownJson);
});

function mergeKnownInfo(parsedFiles, parent = "", json = {}) {
    parsedFiles.forEach(md => {
        let name = parent === "" ? md.title : parent + "/" + md.title;
        //if(!name.includes("Declarations")) return json;
        if (json[name] && json[name]["content"]) {
            json[name]["content"].push({ content: md.content, file: md.file });
        } else {
            json[name] = {
                content: [{ content: md.content, file: md.file }],
                children: []
            }
        }
        json = Object.assign(json, mergeKnownInfo(md.subSections, name, json));
        //json[name]["children"] = Object.keys(newChildren).length === 0 ? children : children.concat(newChildren);
    });
    return json;
}

let merged = mergeKnownInfo(parsedFiles);
fs.writeFileSync("./output/output.json", JSON.stringify(merged));