import { exportProject } from './modules/openproject-neo-util';
import commandLineArgs from 'command-line-args'
import commandLineUsage from 'command-line-usage'
import config from 'config';

const optionDefinitions = [
    {
        name: 'help',
        alias: 'h',
        type: Boolean,
        description: 'Display this usage guide.'
    },
    {
        name: 'apiToken',
        alias: 'a',
        type: String,
        description: 'Token to access the OpenProject API',
        typeLabel: '<apiToken>'
    },
    {
        name: 'openProjectUrl',
        alias: 'o',
        type: String,
        description: 'URL of your OpenProject Installation',
        typeLabel: '<openProjectUri>'
    },
    {
        name: 'username',
        alias: 'u',
        type: String,
        description: 'Name of Neo4j User',
        typeLabel: '<username>'
    },
    {
        name: 'password',
        alias: 'p',
        type: String,
        description: 'Password of Neo4j User',
        typeLabel: '<password>'
    },
    {
        name: 'connectionUri',
        alias: 'c',
        type: String,
        description: 'Connection URI',
        typeLabel: '<connectionUri>'
    },
    {
        name: 'model',
        alias: 'm',
        type: String,
        description: 'Name of the model to which the data shall be extracted.',
    },
    {
        name: 'id',
        type: Number,
        description: 'ID of the project to export',
    }
]

const options = commandLineArgs(optionDefinitions)

if (options.help) {
    const usage = commandLineUsage([
        {
            header: 'Example Usage',
            content: 'node lib/index.js -m OpenProjectModel --id 3'
        },
        {
            header: 'Options',
            optionList: optionDefinitions
        }
    ])
    console.log(usage)
} else {
    console.log(options)
    let connectionUri = options.connectionUri || config.get("connectionUri");
    let username = options.username || config.get("username");
    let password = options.password || config.get("password");
    let model = options.model || config.get("model");
    let id = options.id || config.get("id");

    exportProject(id, model, connectionUri, username, password);
}