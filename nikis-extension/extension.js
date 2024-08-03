// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

let components = [];
let componentInstances = [];

function parseYamlFile(filePath) {
    try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const docs = yaml.loadAll(fileContents);
        return docs; // Returns an array of documents
    } catch (error) {
        console.error(`Error reading YAML file ${filePath}:`, error);
        return null;
    }
}

function findComponentsAndInstances(rootPath) {
    components = [];
    componentInstances = [];

    const files = fs.readdirSync(rootPath, { withFileTypes: true });

    files.forEach(file => {
        const filePath = path.join(rootPath, file.name);
        if (file.isDirectory()) {
            findComponentsAndInstances(filePath); // Recursively find in subdirectories
        } else if (file.isFile() && (file.name.endsWith('.yaml') || file.name.endsWith('.yml'))) {
            console.log(`Parsing file: ${filePath}`);
            console.log(`Parsinf stage Components found: ${components.length}`);
            const docs = parseYamlFile(filePath);
            if (docs) {
                docs.forEach(doc => {
                    if (doc && doc.kind === 'Component') {
                        console.log(`Found Component: ${doc.metadata.name} in ${filePath}`);
                        components.push({
                            name: doc.metadata.name,
                            filePath: filePath,
                            range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0))
                        });
                        console.log(`Components found: ${components.length}`);
                    } else if (doc && doc.kind === 'ComponentInstance') {
                       // console.log(`Found ComponentInstance: ${doc.metadata.name} referencing Component: ${doc.spec.component}`);
                        componentInstances.push({
                            name: doc.metadata.name,
                            componentName: doc.spec.component,
                            filePath: filePath,
                            range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0))
                        });
                    } //else {
                      //  console.log(`Unexpected document kind: ${doc.kind}`);
                    //}
                });
            }
        }
    });

    console.log(`Components found: ${components.length}`);
    console.log(`Component Instances found: ${componentInstances.length}`);
}





class YamlDefinitionProvider {
    provideDefinition(document, position, token) {
        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        // Debugging output
        console.log(`Searching for definition of: ${word}`);

        // Extract component name
        const componentName = this.getComponentNameFromInstance(document, range);
        if (componentName) {
            const component = this.findComponent(componentName);
            if (component) {
                console.log(`Component found: ${component.name}, at ${component.filePath}`);
                return new vscode.Location(vscode.Uri.file(component.filePath), component.range.start);
            } else {
                console.log(`Component ${componentName} not found.`);
            }
        } else {
            console.log('No component name found in the current context.');
        }
        return null;
    }

    getComponentNameFromInstance(document, range) {
        const text = document.getText();
        try {
            // Load all documents
            const docs = yaml.loadAll(text);
            // Check each document
            for (const doc of docs) {
                if (doc.kind === 'ComponentInstance' && doc.spec && doc.spec.component) {
                    return doc.spec.component;
                }
            }
        } catch (e) {
            console.error('Error parsing YAML:', e);
        }
        return null;
    }

    findComponent(name) {
        return components.find(c => c.name === name) || null;
    }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log("Extension activated");

    const rootPath = vscode.workspace.rootPath;
    if (!rootPath) return;

    findComponentsAndInstances(rootPath);
    console.log(components)
    console.log("-----")
    console.log(componentInstances)

    const yamlDefinitionProvider = new YamlDefinitionProvider();
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            { scheme: 'file', language: 'yaml' },
            yamlDefinitionProvider
        )
    );
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
