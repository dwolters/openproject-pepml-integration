# OpenProject to Neo4j Model
This project allows to export OpenProject data as a NeoCore model to Neo4j.
NeoCore is a technique to represent models in a Neo4j database.
The generated model can then be transformed using Triple Graph Grammars.
See [eMoflon::Neo](https://github.com/eMoflon/emoflon-neo) for more details on NeoCore and model transformation.

## Prior to Usage

Run the following commands prior to using this tool for exporting OpenProject data to Neo4j.

```
npm install
tsc
```

## Obtaining an API token

To access the OpenProject API, you need an API token for your specific user. See the [OpenProject Documentation](https://www.openproject.org/docs/api/example/#basic-auth) for further details.

## Persisting credentials

Please enter your database credentials, the URL of your OpenProject installation and your API token in [config/default.json](config/default.json).

## Usage
Export OpenProject data to Neo4j:
```
node lib/index.js -m OpenProjectModel --id 3
```

Replace the model name and project id to fit your settings. 


Further options are available to set the database credentials as command-line arguments. See:
```
node lib/index.js -h
```

## Metamodel of exported models
This project is limited to exporting WorkPackages and Statusses.
The eMSL metamodel for the exported model is the following:

```
metamodel OpenProject {
    Project {
        .name: EString
        <+>-statuses(0..*)->Status
        <+>-workPackages(0..*)->WorkPackage
    }
    Status {
        .name: EString
        .isClosed: EString
    }
    WorkPackage {
        .name: EString
        .type: EString
        -status(1..1)->Status
    }
}
```