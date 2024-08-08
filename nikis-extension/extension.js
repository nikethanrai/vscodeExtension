const vscode = require('vscode');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

let entities = [];

function findEntities(rootPath, entitiesArray) {
    const files = fs.readdirSync(rootPath, { withFileTypes: true });

    files.forEach(file => {
        const filePath = path.join(rootPath, file.name);

        // Ignore .git directory
        if (file.isDirectory() && file.name === '.git') {
            return;
        }

        if (file.isDirectory()) {
            findEntities(filePath, entitiesArray); // Recursively find in subdirectories
        } else if (file.isFile() && (file.name.endsWith('.yaml') || file.name.endsWith('.yml'))) {
            console.log(`Parsing file: ${filePath}`);
            const fileContents = fs.readFileSync(filePath, 'utf8');
            const docs = yaml.loadAll(fileContents);
            if (docs) {
                const lines = fileContents.split('\n');
                docs.forEach(doc => {
                    if (doc && doc.metadata && doc.metadata.name) {
                        const entityName = doc.metadata.name;
                        const startLine = lines.findIndex(line => line.trim().includes(`name: ${entityName}`));
                        
                        // Handle the case where startLine is -1
                        if (startLine === -1) {
                            console.warn(`Entity name '${entityName}' not found in the file: ${filePath}`);
                            return;
                        }
                        
                        const startColumn = lines[startLine].indexOf(`name: ${entityName}`);

                        entitiesArray.push({
                            name: entityName,
                            kind: doc.kind,
                            filePath: filePath,
                            range: new vscode.Range(
                                new vscode.Position(startLine, startColumn),
                                new vscode.Position(startLine, startColumn + entityName.length)
                            ),
                            references: extractReferences(doc.spec)
                        });
                    }
                });
            }
        }
    });
    
    console.log(`Entities found: ${entitiesArray.length}`);
}

function extractReferences(spec) {
    const references = [];
    if (spec) {
        const fieldsToExtract = [
            'component',
            'component_instance',
            'target_component_instance',
            'target_service',
            'dependency'
        ];

        fieldsToExtract.forEach(field => {
            if (spec[field]) {
                references.push(spec[field]);
            }
        });
    }
    return references;
}

class YamlDefinitionProvider {
    provideDefinition(document, position) {
        // Expand the range to capture all text at the position
        const wordRange = document.getWordRangeAtPosition(position, /[\w\-_\s]+/);
        const word = document.getText(wordRange).trim();

        console.log(`Searching for definition of: ${word}`);

        const entity = this.findEntity(word);
        if (entity) {
            console.log(`Entity found: ${entity.name}, at ${entity.filePath}`);
            return new vscode.Location(vscode.Uri.file(entity.filePath), entity.range.start);
        } else {
            console.log(`Entity ${word} not found.`);
        }
        return null;
    }

    findEntity(name) {
        // Match the entire string exactly for the name or references
        return entities.find(e => e.name === name) || null;
    }
}

function activate(context) {
    console.log("Extension activated");

    const rootPath = vscode.workspace.rootPath;
    if (!rootPath) return;

    // Initial scan of the workspace
    findEntities(rootPath, entities);

    // Watch for changes in YAML files
    const yamlWatcher = vscode.workspace.createFileSystemWatcher('**/*.{yaml,yml}');

    yamlWatcher.onDidCreate((uri) => {
        console.log(`YAML file created: ${uri.fsPath}`);
        entities = []; // Clear the entities array
        findEntities(rootPath, entities); // Re-scan to include new file
    });

    yamlWatcher.onDidChange((uri) => {
        console.log(`YAML file changed: ${uri.fsPath}`);
        entities = []; // Clear the entities array
        findEntities(rootPath, entities); // Re-scan to include changes
    });

    yamlWatcher.onDidDelete((uri) => {
        console.log(`YAML file deleted: ${uri.fsPath}`);
        entities = []; // Clear the entities array
        findEntities(rootPath, entities); // Re-scan to remove deleted references
    });

    context.subscriptions.push(yamlWatcher);

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
