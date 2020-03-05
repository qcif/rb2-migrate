//
// Typescript version of Stash 2 -> 3 migration code
//

import {Redbox, Redbox1, Redbox2} from './Redbox';
import {crosswalk, validate} from './crosswalk';
import {ArgumentParser} from 'argparse';
import {postwalk} from './postwalk';
import {Redbox1CsvFiles} from "./Redbox/Redbox1CsvFiles";
import {createPathwayGraph, outputGraph, validateGraph} from "./nodegraph";
import csv = require('csvtojson');
// import {pocGraphLib} from "./nodegraph";

const MANDATORY_CW = [
  'idfield',
  'source_type',
  'dest_type',
  'permissions',
  'required',
  'fields',
];

const fs = require('fs-extra');
const config = require('config');
const util = require('util');
const path = require('path');
const winston = require('winston');
const stringify = require('csv-stringify/lib/sync');
const _ = require('lodash');
const parse = require('csv-parse');

const {format} = winston;
const {combine, label, json} = format;

function getlogger() {
  const logcfs = config.get('logs');
  return winston.createLogger({
    level: 'error',
    format: winston.format.simple(),
    transports: logcfs.map((cf) => {
      if ('filename' in cf) {
        return new winston.transports.File(cf);
      } else {
        return new winston.transports.Console(cf);
      }
    })
  });
}


function connect(server: string): Redbox {
  if (server) {
    const cf = config.get('servers.' + server);
    if (cf['version'] === 'Redbox1') {
      return new Redbox1(cf);
    } else if (cf['version'] === 'Redbox1CsvFiles') {
      return new Redbox1CsvFiles(cf);
    } else {
      return new Redbox2(cf);
    }
  }
}


async function loadcrosswalk(packagetype: string): Promise<Object | undefined> {

  const cwf = path.join(config.get('crosswalks'), packagetype);
  try {
    log.info('Loading crosswalk ' + cwf);
    const cw = await fs.readJson(cwf);
    var bad = false;
    MANDATORY_CW.map((f) => {
      if (!(f in cw)) {
        log.info('Crosswalk section missing: ' + f);
        bad = true;
      }
    });
    if (bad) {
      return null;
    } else {
      return cw
    }
  } catch (e) {
    log.error('Error loading crosswalk ' + cwf + ': ' + e);
    return null;
  }
}

async function migrate(options: Object, outdir: string, records: Object[]): Promise<Object[][]> {
  const source = options['source'];
  const dest = options['dest'];
  const crosswalk_file = options['crosswalk'];

  const cw = await loadcrosswalk(`${crosswalk_file}.json`);
  const source_type = cw['source_type'];
  const dest_type = cw['dest_type'];
  let cwPub, mdPub, mduPub, md2Pub = null;
  let recordMeta = {};
  let pubDestType;
  if (options['publish']) {
    const cwPfile = `${crosswalk_file}.publication.json`;
    cwPub = await loadcrosswalk(cwPfile);
    if (cwPub) {
      log.info(`Loaded publications crosswalk ${cwPfile}`);
    } else {
      log.error(`Loading publications crosswalk ${cwPfile} failed`);
      return [[], []]
    }
  }

  var rbDest;

  try {
    rbDest = connect(dest);
  } catch (e) {
    log.error('Error connecting to dest rb ' + dest + ': ' + e);
    throw new Error(e);
  }

  if (outdir) {
    fs.ensureDirSync(path.join(outdir, 'originals'));
    fs.ensureDirSync(path.join(outdir, 'new'));
  }


  log.info(`Received ${records.length} oids`);
  const n_old = records.length;
  var n_crosswalked = 0;
  var n_created = 0;
  var n_pub = 0;

  var report_lines = [['oid', 'stage', 'ofield', 'nfield', 'status', 'value']];

  const updated = {};

  try {

    for (let record of records) {

      await pauseMigration();

      let oid = record['oid'];
      // console.log('record is now:');
      // console.log(record);
      // console.log('oid is:');
      // console.log(oid);
      if (_.isEmpty(oid)) {
        oid = record['objectId'];
      }
      if (_.isEmpty(oid)) {
        log.error("No oid or objectId found for %j", record);
        continue;
      }
      if (_.isEmpty(updated[oid])) {
        updated[oid] = {};
      }
      _.assign(updated[oid], record);
      log.info(`Processing oid ${oid}`);

      let md = record;
      if (!md) {
        log.error(`Couldn't get source record for ${oid}`);
        updated[oid]['status'] = 'load failed';
        continue;
      }
      log.info('1. got source record successfully');

      const report = (stage, ofield, nfield, msg, value) => {
        report_lines.push([oid, stage, ofield, nfield, msg, value]);
        if (_.isObjectLike(value)) {
          value = JSON.stringify(value);
        }
        updated[oid]['status'] = msg + ': ' + value; // status is always last thing
      };

      const [mdu, md2] = crosswalk(cw, md, report);
      log.info('3. have md2');
      // console.dir(md2);
      updated[oid]['status'] = 'crosswalked';
      n_crosswalked += 1;
      var noid = 'new_' + oid;

      if (outdir) {
        dumpjson(outdir, 'originals', oid, md);
        dumpjson(outdir, 'originals', oid + '_unflat', mdu);
        dumpjson(outdir, 'new', oid, md2);
      }

      const errors = validate(record['owner'], cw['required'], md2, report);

      if (errors.length > 0) {
        report('validate', '', '', 'invalid', errors.join('; '));
        log.error('5. failed validation.');
        log.error(errors);
        log.warn('skipping to next record...');
        continue;
      } else {
        // this will be the last status if we're in dry-run/index mode, so
        // it overwrites any warnings from validate() above
        log.info('5. passed validation.');
        report('validate', '', '', 'valid', '');
      }
      if (!rbDest || args['index']) {
        log.warn('6a. No dest.');
        continue;
      }
      log.info('6a. dest present. continuing');

      try {
        if (args['crosswalk'] === 'pathway') {
          console.log('Generating data structure and visual graph of pathway...');
          const errorMessages = [];
          const g = createPathwayGraph(md2, log, errorMessages);
          console.log('Validating pathway graph...');
          validateGraph(g, errorMessages);
          // always create output (seeing what sinks,sources, cycles are if problems is useful)
          outputGraph(g);
          const reportTitle = 'validate pathway graph';
          if (_.isEmpty(errorMessages)) {
            report(reportTitle, '', '', 'valid', '');
            log.info('6b. passed pathway graph validation.');
          } else {
            report(reportTitle, '', '', 'invalid', errorMessages);
            log.error('6b. failed pathway graph validation...');
            log.error(`error messages from graph validation: ${JSON.stringify(errorMessages, null, 4)}`);
            continue;
          }
        }
      } catch (e) {
        log.error(e);
        report('graphing pathway', '', '', 'failed', e);
        await pauseMigration();
        continue;
      }

      try {
        log.debug('Creating data record...');
        noid = await rbDest.createRecord(md2, dest_type);
        if (noid) {
          n_created += 1;
          updated[oid]['noid'] = noid;
          report('create', '', '', 'created', noid);
          log.info('7. Create record succeeded');
        } else {
          throw('Create data record failed, so no noid returned.');
        }
      } catch (e) {
        log.error('7. There was an error in creating data record.');
        log.warn('skipping to next record...');
        log.error(e);
        report('create', '', '', 'create failed', e);
        await pauseMigration();
        continue;
      }

      try {
        const perms = await setpermissions(rbDest, noid, oid, md2, cw['permissions']);
        if (!perms) {
          throw('unknown error');
        }
        if ('error' in perms) {
          throw(perms['error']);
        }
        report('permissions', '', '', 'set', JSON.stringify(perms));
        log.info('8. Successfully created record permissions.');
      } catch (e) {
        log.error('8. There was an error in creating data record permissions.');
        log.error(e);
        report('permissions', '', '', 'failed', e);
        log.warn('skipping to next record...');
        continue;
      }
      try {
        log.info("Updating Redbox2 data record metaMetadata...");
        let metaMetadataObject = await rbDest.getRecordMetadata(noid);
        metaMetadataObject['legacyId'] = oid;
        log.verbose('getting contributor_ci relationships...');
        // Redbox2 Mint parties/relationships don't always match Redbox1 records. Persist these in case needed later in dataRecord life - no harm then in overwriting contributor_ci in Redbox2 or adding Redbox2 Mint relationships later.
        log.verbose(JSON.stringify(_.get(md2, 'contributor_ci')));
        const parties = _.get(md2, 'contributor_ci.parties');
        if (!_.isEmpty(parties)) {
          _.set(metaMetadataObject, 'legacy.contributor_ci.parties', parties);
        }
        const relationshipTypes = _.get(md2, 'contributor_ci.relationshipType');
        if (!_.isEmpty(relationshipTypes)) {
          _.set(metaMetadataObject, 'legacy.contributor_ci.relationshipType', relationshipTypes);
        }

        _.set(metaMetadataObject, 'legacy.record', md);
        // log.verbose('metaMetadata object is:...');
        // log.verbose(JSON.stringify(metaMetadataObject));
        const metaMetadataResult = await (<Redbox2>rbDest).updateRecordObjectMetadata(noid, metaMetadataObject);
        if (!metaMetadataResult) {
          throw('Unknown error in setting metaMetadata.');
        }
        if ('error' in metaMetadataResult) {
          throw(metaMetadataResult['error']);
        }
        report('metaMetaData', 'oid', 'legacyId', 'set', JSON.stringify(metaMetadataResult));
        log.info('9. Succeeded in updating record metaMetadata.');
      } catch (e) {
        log.error('9. There was an error in updating record metaMetadata.');
        log.error(e);
        report('metaMetaData', 'oid', 'legacyId', 'failed', e);
        log.info('Ignoring metaMetaData fail. Ignoring skipping to next record...');
        // continue;
      }

      if (cw['postTasks']) {
        try {
          recordMeta = await rbDest.getRecord(noid);
          log.info('10. Succeeded in get for post tasks.');
        } catch (e) {
          log.error('10. There was an error in get for post tasks.');
          report('postwalk', '', '', 'getRecord failed', e);
          log.warn('skipping to next record...');
          continue;
        }

        try {
          const newRecordMeta = postwalk(cw['postTasks'], recordMeta, report);
          dumpjson(outdir, 'new', oid + '_postwalk', newRecordMeta);
          const enoid = await rbDest.updateRecordMetadata(noid, newRecordMeta);
          log.info('10b. Succeeded in post tasks metadata update.');
        } catch (e) {
          log.error('10b. Failed in post tasks metadata update.');
          report('postwalk', '', '', 'postwalk failed', e);
        }
      } else {
        log.info('10. Skipping post tasks.');
      }

      if (!cwPub) {
        log.info('11. Skipping publication as not requested.');
        continue;
      }

      const report_pub = (stage, ofield, nfield, msg, value) => {
        report_lines.push([oid + "_pub", stage, ofield, nfield, msg, value]);
        // FIXME status should get updated too
      };

      let pubOid;
      try {
        let mdPub = record;
        log.info(`11. Got record ${oid} for publication crosswalk`);
        report("publication", '', '', 'Crosswalking', '');
        const resPub = crosswalk(cwPub, mdPub, report_pub);
        mduPub = resPub[0];
        md2Pub = resPub[1];
        // dest_type in the next line is the primary type this is a publication for,
        // ie its parent, a dataRecord
        md2Pub[dest_type] = {
          oid: noid,
          title: md2['title']
        };

        log.info(`parent link to ${dest_type}: ${JSON.stringify(md2Pub[dest_type])}`);

        ['ci', 'data_manager'].forEach((type) => {
          const f = 'contributor_' + type;
          md2Pub[f] = _.clone(md2[f]);
          log.info(`${type} from data record ${JSON.stringify(md2Pub[f])}`);
          if (!md2Pub[f]) {
            report_pub("publication", f, f, "No value", "");
          } else {
            report_pub("publication", f, f, "copied", JSON.stringify(md2Pub[f]));
          }
        });
        // In only Redbox1, embargoed is part of metadata and not a workflow stage
        // draft or self-submission should not go to embargoed workflow
        md2Pub["workflowStage"] = cwPub["to_workflow"];
        if (_.get(md2Pub, 'embargoByDate', false) && !_.includes(['draft', 'jcu-self-submission-draft'], _.get(cw, 'workflow_step', ''))) {
          md2Pub["workflowStage"] = 'embargoed';
        }
        dumpjson(outdir, 'new', oid + '_publication', md2Pub);
        dumpjson(outdir, 'originals', oid + '_pub_unflat', mduPub);
        n_pub += 1;
        log.debug('about to create publication...');
        // console.log(`md2Pub now:`)
        // console.log(md2Pub)
        pubOid = await rbDest.createRecord(md2Pub, cwPub['dest_type']);
        report('published', '', '', 'publication created', '');
        log.info('11. Publication create completed ok.');
      } catch (e) {
        log.error("11. Publish error: " + e);
        report('published', '', '', 'publish failed', e.message);
      }
      log.info(`12. No attachments for record: ${oid}`);
    }

    log.info(`${n_crosswalked} crosswalked`);
    if (dest) {
      log.info(`${n_created} created as ${dest_type} in ${dest}`);
      if (n_pub) {
        log.info(`${n_pub} created as publications in ${dest}`);
      }
    } else {
      log.info("No --dest specified, no records created.");
    }

    const updated_list = [];

    for (const record of records) {
      const oid = record['storage_id'] || record['id'] || record['objectId'] || record['oid'] || '';
      if (!_.isEmpty(oid)) {
        updated_list.push(updated[oid]);
      }
    }

    return [updated_list, report_lines];

  } catch (e) {
    log.error('Migration error:' + e);
    var stack = e.stack;
    log.error(stack);
    return [[], []];
  }

}

async function pauseMigration() {
  if (args['wait']) {
    const waitPeriod = args['wait'];
    const waited = await sleep(waitPeriod);
    log.debug('continue...');
  }
}

// Set the permissions on a newly created record. Works like this:
//
// - read the permissions from the old record
// - add edit, view for the FNCI and Data Manager of the new record
// - add view for all of the contributors of the new record
//
// This preserves any extra people granted view access in RB 1.9

async function setpermissions(rbDest: Redbox, noid: string, oid: string, md2: Object, pcw: Object): Promise<Object> {
  var perms = {view: ['guest'], edit: ['guest']};
  log.debug("Permissions:");
  log.info(JSON.stringify(perms));
  try {
    const view = await rbDest.grantPermission(noid, 'view', {users: perms['view']});
    log.debug(`view is `);
    log.debug(JSON.stringify(view));
    const edit = await rbDest.grantPermission(noid, 'edit', {users: perms['edit']});
    return {'success': true};
  } catch (e) {
    throw e;
  }
}


async function dumpjson(outdir: string, subdir: string, file: string, md: Object): Promise<void> {
  await fs.writeJson(
    path.join(outdir, subdir, util.format('%s.json', file)),
    md,
    {spaces: 4}
  );
}


async function writeindex(index_o: Object, filename: string): Promise<void> {
  const index_headers = [
    'oid', 'noid', 'file', 'packageType', 'workflow_step', 'owner', 'title', 'description',
    'status', 'date_created', 'date_modified', 'rules_oid'
  ];
  const index = [index_headers];
  for (var oid in index_o) {
    index.push(index_headers.map((f) => {
      return index_o[oid][f]
    }));
  }
  await writereport(index, filename);
}


async function writeerrors(errors_o: Object, filename: string): Promise<void> {
  const error_headers = [
    'oid', 'file', 'error'
  ];
  const errors = [error_headers];
  for (var oid in errors_o) {
    errors.push(error_headers.map((f) => {
      return errors_o[oid][f]
    }));
  }
  await writereport(errors, filename);
}

async function writereport(report: Object, fn: string): Promise<void> {
  log.info(`Writing csv to ${fn}: ${JSON.stringify(report[0])}`);
  const csvstr = stringify(report);
  await fs.outputFile(path.normalize(fn), csvstr);
  log.info('Report done.');
}

function getInputResource() {
  const resources = _.get(config, ['servers', 'source', 'resources']);
  const resourcesDir = _.get(resources, 'directory', 'resources');
  return function (crosswalkFileName) {
    const crosswalkFilePath = `${resourcesDir}/${crosswalkFileName}.csv`;
    return crosswalkFilePath
  }
}

const inputResourceFile = getInputResource();

async function main(args) {

  const timestamp = Date.now().toString();
  const name = args['crosswalk'] || 'all';
  const outdir = path.join(args['outdir'], `report_${name}_${timestamp}`);

  if (!(args['crosswalk'] || args['index'])) {
    throw new Error("Usage: A crosswalk must be provided. An index only is not permitted.");
  }
  const inputCsv = args['csv'] || args['crosswalk'];
  const records = await ingestCsv(inputCsv, args['crosswalk']);
  // log.debug(`records are ${JSON.stringify(records, null, 4)}`);
  // log.debug('Migrating custodian and related data for searching...');
  if (args['crosswalk']) {
    const [updated_records, report] = await migrate(args, outdir, records);
    log.debug(`updated records are: ${JSON.stringify(updated_records, null, 4)}`);
    await writeindex(updated_records, path.join(outdir, `index_${timestamp}.csv`));
    await writereport(report, path.join(outdir, `report_${timestamp}.csv`));
  } else {
    await writeindex(records, path.join(outdir, `index_${timestamp}.csv`));
  }
  // await pocGraphLib();
}

async function ingestCsv(inputCsv, crosswalk) {
  const sourceFilePath = inputResourceFile(inputCsv);
  log.debug(`csv file path is: ${sourceFilePath}`);
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error(`Unable to find source file: ${sourceFilePath}`);
  }
  const records = [];
  let pathway = {};
  let responsesTracker = {};
  let qNo, kNo, rNo, hNo, sNo;
  qNo = rNo = hNo = sNo = 0;

  function buildPathway(current, next) {
    const pNo = `p${next['pathway']}`;
    let type, key;
    switch (_.camelCase(next['type'])) {
      case 'question':
        type = 'questions';
        key = `q${++qNo}`;
        break;
      // change all help types to 'type':'help' and rename original type as 'subType'
      case 'toolTip':
      case 'popup':
      case 'help':
      case 'localHelp':
        type = 'help';
        key = `h${++hNo}`;
        if (next['type'] !== 'help') {
          next['subType'] = _.camelCase(next['type']);
          next['type'] = 'help';
        }
        break;
      case 'response':
        type = 'responses';
        key = `r${++rNo}`;
        // let currentResponsesTracker = _.get(responsesTracker, pNo);
        // if (!currentResponsesTracker) {
        //   currentResponsesTracker = [];
        //   _.set(responsesTracker, pNo, currentResponsesTracker)
        // } else if (_.includes(currentResponsesTracker, next['content'])) {
        //   // don't ignore repeated content as they have different next steps - just warn for debug purposes
        //   // log.warn(`${JSON.stringify(current[pNo][type], null, 4)} already contains value: ${next['content']}. Going ahead and adding again...`);
        //   // return;
        //
        // }
        // currentResponsesTracker.push(next['content']);
        break;
      case 'summary':
        type = 'summary';
        key = `s${++sNo}`;
        break;
      default:
        log.warn(`No handler for type: ${next['type']}. Skipping...`);
        return
    }
    let nextNode = `${pNo}.${type}.${key}`;
    _.set(current, `${nextNode}`, next);
  }

  function capitalizeAndSpace(n) {
    return _.capitalize(_.lowerCase(n));
  }


  // TODO: complete knowledgeBase - pathway does not have all of the 'non' QandA nodes e.g., title, description etc. knowledge base should have everything.
  await csv()
    .fromFile(sourceFilePath)
    .preFileLine((fileLineString, lineIdx) => {
      return new Promise((resolve, reject) => {
        if (lineIdx === 0) {
          // ensure headers are consistent
          switch (args['crosswalk']) {
            case 'pathway':
              fileLineString = _.join(_.map(_.split(fileLineString, ','), _.camelCase));
              break;
            default:
              fileLineString = _.join(_.map(_.split(fileLineString, ','), capitalizeAndSpace));
              break;
          }
          // log.debug(`incoming headers are: ${fileLineString}`)
        }
        // log.debug(`incoming: ${fileLineString}`);
        resolve(fileLineString);
      })
    })
    .subscribe((jsonObj, index) => {
      return new Promise((resolve, reject) => {
        // log.debug('next line...');
        // log.debug(index);
        // log.debug(JSON.stringify(jsonObj, null, 4));
        jsonObj.oid = `${args['crosswalk']}${index}`;
        resolve();
      });
    })
    .on('data', (jsonObj) => {
      // log.debug('have transformed data..');
      switch (crosswalk) {
        case 'knowledgeBase':
          log.debug('in knowledgeBase...');
          // for poc using same pathway file - some of these do not have source as knowledgeBase
          if (JSON.parse(jsonObj.toString())['source'] === 'knowledgeBase') {
            log.debug(JSON.stringify(JSON.parse(jsonObj.toString())), null, 4);
            records.push(JSON.parse(jsonObj.toString()));
          }
          break;
        case 'pathway':
          // log.debug('in pathway...');
          buildPathway(pathway, JSON.parse(jsonObj));
          break;
        case 'dataset':
          // log.debug(JSON.stringify(JSON.parse(jsonObj.toString())), null, 4);
          const existing = JSON.parse(jsonObj.toString());
          // console.dir(existing);
          const toPush = {};
          const whitelist = ['oid', 'Name', 'Description', 'Data custodian statewide', 'Data custodian position details', 'Data custodian phone', 'Data custodian fax', 'Data custodian email', 'Application custodian phone', 'Application custodian fax', 'Application custodian email']
          _.forEach(existing, function(nextValue, nextKey) {
            console.log(`${nextKey}: ${nextValue}`);
            // have existing object that will be used to just copy everything as is - we can extract the special cases from this main object.
            if (!_.includes(whitelist, nextKey)) {
              _.set(toPush, `data.${nextKey}`, nextValue);
            } else {
              _.set(toPush, nextKey, nextValue);
            }
          });
          // console.dir(toPush);
          records.push(toPush);
          break;
        default:
          records.push(JSON.parse(jsonObj.toString()));
      }
    })
    .on('error', (err) => {
      console.log(err)
    })
    .on('end', () => {
      console.log('Csv ingest is done!')
    });
  if (!_.isEmpty(pathway)) {
    _.each(pathway, function (value, key) {
      _.set(value, 'oid', key);
      records.push(value)
    });
  }
  // await pocGraphLib(records);
  return records;
}

const sleep = ms => new Promise((r, j) => {
  log.info('Waiting for ' + ms + ' seconds');
  setTimeout(r, ms * 1000);
});


const log = getlogger();

var parser = new ArgumentParser({
  version: '0.0.1',
  addHelp: true,
  description: 'ReDBox 1.x -> 2.0 migration script'
});


parser.addArgument(
  ['-c', '--crosswalk'],
  {
    help: 'Crosswalk (package type + workflow step). Leave empty for a list of available crosswalks.',
    defaultValue: 'dataset'
  }
);

parser.addArgument(
  ['-q', '--csv'],
  {
    help: 'csv ingest source.',
    defaultValue: null
  }
);

parser.addArgument(
  ['-s', '--source'],
  {
    help: 'ReDBox server to migrate records from.',
    defaultValue: 'source'
  }
);

parser.addArgument(
  ['-d', '--dest'],
  {
    help: 'ReDBox server to migrate records to. Leave out to run in test mode.',
    defaultValue: null
  }
);


parser.addArgument(
  ['-o', '--outdir'],
  {
    help: 'Write diagnostics and logs to this directory.',
    defaultValue: './'
  }
);

parser.addArgument(
  ['-n', '--number'],
  {
    help: 'Limit migration to first n records',
    defaultValue: null
  }
);

parser.addArgument(
  ['-i', '--index'],
  {
    help: 'Only write an index of the records to be crosswalked. If no --crosswalk is given, indexes all records.',
    action: 'storeTrue',
    defaultValue: false
  }
);

parser.addArgument(
  ['-r', '--record'],
  {
    help: 'Specify a single record to migrate, by oid on the source.',
    defaultValue: null
  }
);


parser.addArgument(
  ['-p', '--publish'],
  {
    help: 'Copies records into publication draft',
    action: 'storeTrue',
    defaultValue: false
  }
);

parser.addArgument(
  ['-w', '--wait'],
  {
    help: 'Waits for X amounts of seconds for each crosswalk',
    defaultValue: undefined
  }
);

const args = parser.parseArgs();

main(args);

