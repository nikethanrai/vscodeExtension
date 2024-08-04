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

function findComponentsAndInstances(rootPath, componentsArray, componentInstancesArray) {
    const files = fs.readdirSync(rootPath, { withFileTypes: true });

    files.forEach(file => {
        const filePath = path.join(rootPath, file.name);
        if (file.isDirectory()) {
            findComponentsAndInstances(filePath, componentsArray, componentInstancesArray); // Recursively find in subdirectories
        } else if (file.isFile() && (file.name.endsWith('.yaml') || file.name.endsWith('.yml'))) {
            console.log(`Parsing file: ${filePath}`);
            const fileContents = fs.readFileSync(filePath, 'utf8');
            const docs = yaml.loadAll(fileContents);
            if (docs) {
                const lines = fileContents.split('\n');
                docs.forEach(doc => {
                    if (doc && doc.kind === 'Component') {
                        const componentName = doc.metadata.name;
                        const startLine = lines.findIndex(line => line.includes(`name: ${componentName}`));
                        const startColumn = lines[startLine].indexOf(`name: ${componentName}`);

                        componentsArray.push({
                            name: componentName,
                            filePath: filePath,
                            range: new vscode.Range(
                                new vscode.Position(startLine, startColumn),
                                new vscode.Position(startLine, startColumn + componentName.length)
                            )
                        });
                    } else if (doc && doc.kind === 'ComponentInstance') {
                        const componentInstanceName = doc.metadata.name;
                        const startLine = lines.findIndex(line => line.includes(`name: ${componentInstanceName}`));
                        const startColumn = lines[startLine].indexOf(`name: ${componentInstanceName}`);

                        componentInstancesArray.push({
                            name: componentInstanceName,
                            componentName: doc.spec.component,
                            filePath: filePath,
                            range: new vscode.Range(
                                new vscode.Position(startLine, startColumn),
                                new vscode.Position(startLine, startColumn + componentInstanceName.length)
                            )
                        });
                    }
                });
            }
        }
    });

    console.log(`Components found: ${componentsArray.length}`);
    console.log(`Component Instances found: ${componentInstancesArray.length}`);
}

class YamlDefinitionProvider {
    provideDefinition(document, position, token) {
        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);

        console.log(`Searching for definition of: ${word}`);

        const componentName = this.getComponentNameFromInstance(document, word);
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

    getComponentNameFromInstance(document, word) {
        const text = document.getText();
        try {
            const docs = yaml.loadAll(text);
            for (const doc of docs) {
                if (doc.kind === 'ComponentInstance' && doc.spec && doc.spec.component) {
                    if (doc.metadata.name === word || doc.spec.component === word) {
                        return doc.spec.component;
                    }
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

function activate(context) {
    console.log("Extension activated");

    const rootPath = vscode.workspace.rootPath;
    if (!rootPath) return;

    findComponentsAndInstances(rootPath, components, componentInstances);

    console.log("Components found:", components);
    console.log("Component Instances found:", componentInstances);

    const yamlDefinitionProvider = new YamlDefinitionProvider();
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            { scheme: 'file', language: 'yaml' },
            yamlDefinitionProvider
        )
    );
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
