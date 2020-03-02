const winston = require('winston');
const _ = require('lodash');
const fs = require('fs-extra');
const graphLib = require("graphlib");
const dot = require("graphlib-dot");
const graphviz = require("graphviz");

let log;

export function createPathwayGraph(pathway, logger, errorMessages) {
  // console.dir(logger);
  let g = initializeGraph();
  log = logger;

  _.each(pathway.nodes, function (nextNode, key) {
    let graphType = !_.isEmpty(_.get(nextNode, 'subType')) ? `${nextNode['type']}_${nextNode['subType']}` : nextNode['type'];
    //graph lib will just replace node values if duplicates - enforce strictness here as we do not want duplicates in our source data
    if (g.hasNode(key)) {
      errorMessages.push(`Duplicate key found: ${key}.`);
      return g;
    }
    g.setNode(key, {label: `${graphType} ${key}`});
  });
  _.each(pathway.edges, function (nextEdge) {
    g.setEdge(nextEdge.u, nextEdge.v);
  });
  return g;
}

function initializeGraph() {
  let graphJson = {
    options: {
      directed: true,
      multigraph: false,
      compound: true
    }
  };
  let g = graphLib.json.read(graphJson);
  return g;
}

export function validateGraph(g, errorMessages) {
  // log.info(JSON.stringify(graphLib.json.write(g), null, 4));
  const isAcyclic = graphLib.alg.isAcyclic(g);
  log.info(`is acyclic: ${isAcyclic}`);
  if (!isAcyclic) {
    errorMessages.push("Cycles detected in graph");
  }
  // log.info(`top sort is: ${graphLib.alg.topsort(g)}`);
  // log.info(JSON.stringify(graphLib.alg.floydWarshall(g, function(e) { return g.edge(e); }),null,4));

  const sources = g.sources();
  const questionSources = _.filter(sources, function (nextNode) {
    const label = _.get(g.node(nextNode), 'label');
    return _.startsWith(label, 'question');
  });
  log.info(`question sources: ${JSON.stringify(questionSources, null, 4)}`);
  if (questionSources.length !== 1) {
    errorMessages.push("Does not have an exclusive 'question' node from which to start");
  }

  const sinks = g.sinks();
  const hasAtLeast1ResponseSink = _.find(sinks, function (nextNode) {
    const label = _.get(g.node(nextNode), 'label');
    return _.startsWith(label, 'response');
  });
  const hasAtLeast1SummarySink = _.find(sinks, function (nextNode) {
    const label = _.get(g.node(nextNode), 'label');
    return _.startsWith(label, 'summary');
  });
  log.info(`has at least 1 response sink: ${hasAtLeast1ResponseSink}`);
  log.info(`has at least 1 summary sink: ${hasAtLeast1SummarySink}`);
  if (!hasAtLeast1ResponseSink && !hasAtLeast1SummarySink) {
    errorMessages.push("Does not have at least 1 'response' or 1 'summary' node on which to finish.");
  }

  return errorMessages;
}

export function outputGraph(g) {
  outputGraphAsJson(g, 'resources/output.json');
  const dotOutputFilePath = 'resources/graph.dot';
  outputGraphAsDotFile(g, dotOutputFilePath);
  outputGraphAsDrawing(g, dotOutputFilePath, 'resources/test01.png');
  outputWithoutHelpOrSummaryNodes(g);
}

export function outputWithoutHelpOrSummaryNodes(originalGraph) {
  const g = _.cloneDeep(originalGraph);
  _.each(g.nodes(), function(v) {
    console.dir(v);
    const label = _.get(g.node(v), 'label');
    console.log(label);
    if (_.startsWith(label, 'summary') || _.startsWith(label, 'help')) {
      g.removeNode(v)
    }
  });
  outputGraphAsJson(g, 'resources/output_min.json');
  const dotOutputFilePath = 'resources/graph_min.dot';
  outputGraphAsDotFile(g, dotOutputFilePath);
  outputGraphAsDrawing(g, dotOutputFilePath, 'resources/test01_min.png');
}

function outputGraphAsJson(g, filePath) {
  log.info("Creating a json file representation of graph...");
  fs.outputJsonSync(filePath, graphLib.json.write(g));
}

function outputGraphAsDotFile(g, filePath) {
  log.info("Creating a dot file representation of graph...");
  fs.outputFileSync(filePath, `${dot.write(g)}`);
}

function outputGraphAsDrawing(g, inputFilePath, outputFilePath) {
  fs.ensureFileSync(inputFilePath);
  graphviz.parse(inputFilePath, dotRendererFn(outputFilePath), errback);
}

function dotRendererFn(filePath, vizPath = '/usr/local/bin') {
  return function (graph) {
    graph.setGraphVizPath(vizPath);
    graph.output("png", filePath);
    log.info('Completed creation of graph viz file.');
  }
}

function errback(code, out, err) {
  log.warn('Graph drawing error');
  throw new Error(err);
}
