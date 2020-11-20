//
// Typescript version of Stash 2 -> 3 migration code
//

import {Redbox, Redbox1, Redbox2} from './Redbox';
import {crosswalk, validate} from './crosswalk';
import {ArgumentParser} from 'argparse';
import {postwalk} from './postwalk';
import * as FormData from "form-data";
import * as stream from 'stream';
const csv = require('csv-parser');

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

// info: prints out info about a source to STDOUT, including a list of
// available crosswalk files

async function info(source: string) {
  log.debug('Source');
  const rbSource = connect(source);
  const r = await rbSource.info();
  log.info(r);
  const crosswalk_d = config.get('crosswalks');
  if (crosswalk_d) {
    log.info("Available crosswalks:");
    const d = await fs.readdir(crosswalk_d);
    d.map((f) => {
      var m = f.match(/^(.*?)\.json$/);
      if (m) {
        log.info(m[1]);
      }
    });
    log.info("Run the script with --index and no --crosswalk for a list of all records in --source");
  } else {
    log.info("No crosswalks configured");
  }
}


// index: calls source.list to get a list of oids for the requested
// crosswalk, or all oids in the source if there's no crosswalk.

// returns two lists of objects: an index of {} representing each
// oid, and a list of errors

async function index(options: Object): Promise<Object[][]> {
  const source = options['source'];
  const crosswalk_file = options['crosswalk'];
  const limit = options['number'];
  const recordId = options['record'];
  var rbSource;

  try {
    rbSource = connect(source);
  } catch (e) {
    log.error('Error connecting to source rb ' + source + ': ' + e);
    throw new Error(e);
  }

  var oids;

  let filter = {};
  if (crosswalk_file) {
    const cw = await loadcrosswalk(`${crosswalk_file}.json`);
    const source_type = cw['source_type'];
    _.merge(filter, {packageType: source_type});
    if (cw['workflow_step']) {
      _.merge(filter, {workflow_step: cw['workflow_step']});
    }
    //handle record filtering early rather than later
    if (recordId) {
      let recordFilterOr = rbSource.makeSolrQueryOR({
        id: recordId,
        storage_id: recordId,
        objectId: recordId,
        oid: recordId
      });
      let recordFilterJoinOr = rbSource.makeSolrQueryAND(filter);
      filter = `(${recordFilterOr})%20AND%20${recordFilterJoinOr}`
    }
  }
  log.debug(`Sending filter to solr: ${JSON.stringify(filter)}`);
  const returnedList = await rbSource.listSolr(filter);
  oids = returnedList.map(function (d) {
    let returnedId = d['id'] || d['storage_id'] || d['oid'] || d['objectId'];
    if (_.isArray(returnedId)) {
      returnedId = _.head(returnedId);
    }
    log.verbose(`returning id: ${returnedId}`);
    return returnedId;
  });
  log.info(`Loaded index of ${oids.length} records`);
  if (limit && parseInt(limit) > 0) {
    oids.splice(limit);
    log.info(`Limited to first ${oids.length} records`);
  }
  let allRecordsAttachments;
  if (oids.length > 0) {
    allRecordsAttachments = await collectRecordAttachments(rbSource);
  }
  // log.debug(`all records attachments are:`);
  // console.dir(allRecordsAttachments);
  let records = [];
  for (let oid of oids) {
    try {
      log.debug(`oid is ${oid}`);
      let rbSourceRecord = await rbSource.getRecord(oid);
      const rbSourceRecordMetadata = await rbSource.getRecordMetadata(oid);
      if (rbSourceRecord) {
        let recordAttachments = {};
        recordAttachments['attachments'] = allRecordsAttachments[rbSourceRecordMetadata['objectId'] || rbSourceRecord[0]['id'] || rbSourceRecord['storage_id'] || rbSourceRecord['oid']] || [];
        records.push(_.assign({}, rbSourceRecord, rbSourceRecordMetadata, recordAttachments));
      }
    } catch (error) {
      log.error("There was an error in indexing.");
      log.error(error);
    }
  }
  const errors = rbSource.errors;
  if (errors) {
    log.info(errors);
    log.info(`Parse errors for ${errors.length} items`);
  }
  return [records, errors];
}


async function collectRecordAttachments(rbSource: Redbox1): Promise<Object> {
  const attachments = await rbSource.prepareAndGetSolr({
    display_type: 'attachment'
  }, ['id', 'storage_id', 'oid', 'objectId', 'filename', 'attached_to']);
  log.info(`Number of attachments returned: ${attachments.length}`);
  const attachmentsBrief = {};
  _.forEach(attachments, function (attachment) {
    // log.verbose('Next attachment...');
    // log.verbose(attachment);
    let attachId = attachment['id'] || attachment['storage_id'] || attachment['oid'];
    if (_.isArray(attachId)) {
      attachId = _.head(attachId);
    }
    if (attachId && _.has(attachment, 'filename')) {
      // log.debug("Found attachment match:");
      // log.verbose(JSON.stringify(attachment));
      let filename = attachment['filename'];
      if (_.isArray(filename)) {
        filename = _.head(filename);
      }
      // log.verbose(`filename to attach is: ${filename}`);
      let nextAttachment = {
        attachId: attachId,
        attachFilename: filename
      };
      let attachmentName = attachment.attached_to[0];
      if (_.isEmpty(attachmentsBrief[attachmentName])) {
        attachmentsBrief[attachmentName] = [];
      }
      attachmentsBrief[attachmentName].push(nextAttachment);
    } else {
      // log.verbose(`No filename found for attachment: ${_.toString(attachId)}`);
    }
  });
  log.debug('Completed collecting all attachments for each record');
  // log.verbose(JSON.stringify(attachmentsBrief, null, 4));
  return attachmentsBrief;
}

// migrate - takes the list of records from index() plus the args
// object, and returns a new copy of the index (with extra metadata and
// status messages from the crosswalk) and the detailed report.

// Note that even after refactoring index() out of it, this function is
// still a mess

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

  var rbSource, rbDest;

  try {
    rbSource = connect(source);
  } catch (e) {
    log.error('Error connecting to source rb ' + source + ': ' + e);
    throw new Error(e);
  }

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

  const recordOwnerCsvFileName = _.get(config, 'recordOwnersCsvFilename');
  log.debug(`csv file name is: ${recordOwnerCsvFileName}`);
  const recordOwnerCsvFilePath = `resources/${recordOwnerCsvFileName}`;
  log.debug(`csv file to parse is: ${recordOwnerCsvFilePath}`);
  if (!fs.existsSync(recordOwnerCsvFilePath)) {
    throw new Error(`Unable to find file: ${recordOwnerCsvFilePath}`);
  }

  try {
    const csvParserErrorOK = "PARSE ENDED OK";
    for (let record of records) {

      await pauseMigration();

      let oid = record['oid'];
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

      let md = await rbSource.getRecord(oid);
      if (!md) {
        log.error(`Couldn't get source record for ${oid}`);
        updated[oid]['status'] = 'load failed';
        continue;
      }
      log.info('1. got source record successfully');


      updated[oid]['title'] = md['dc:title'];
      updated[oid]['description'] = md['dc:description'];

      const report = (stage, ofield, nfield, msg, value) => {
        report_lines.push([oid, stage, ofield, nfield, msg, value]);
        if (_.isObjectLike(value)) {
          value = JSON.stringify(value);
        }
        updated[oid]['status'] = msg + ': ' + value; // status is always last thing
      };
      let titleCheck = record['dc:title'];
      if (!_.isEmpty(titleCheck) && titleCheck.toLowerCase() === '[untitled]') {
        log.error(`2. title for record: ${oid} failed validation.`);
        report('load', '', '', 'Unacceptable title', `${titleCheck}`);
        continue;
      } else {
        log.info('2. have valid title...');
      }

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

      //TODO: check that can get record owner email details into migration (from database -> may need to export and read into migration)
      log.debug('Checking for record owner...');
      if (_.isEmpty(_.get(record, 'owner'))) {
        log.info('4. No owner. Will use CI data...');
        if (_.get(md2, 'contributor_ci.text_full_name')) {
          record['owner'] = md2['contributor_ci']['text_full_name'];
          report('load', '', '', 'no owner, replaced with ci full name', '');
          log.info('4a. using CI as owner...');
        } else {
          report('load', '', 'contributor_ci', `No CI or owner`, '');
          log.info('4a. fail as NO owner OR CI...');
          continue;
        }
      } else {
        log.info('4. Have owner...');
        log.debug(record['owner']);
      }
      const ci = md2['contributor_ci'];
      log.debug(`CI data is: ${JSON.stringify(md2['contributor_ci'], null, 4)}`);
      if (!_.isEmpty(ci) && _.isEmpty(ci['email'])) {
        log.debug('Have a CI, but no CI email. Searching for alternative email...');
        let readStream = null;
        let parser = null;
        try {
          readStream = await fs.createReadStream(recordOwnerCsvFilePath);
          parser = csv(['id', 'owner', 'email', 'text_full_name']);
          parser.on('data', (row) => {
            // log.debug('Reading next row...');
            const nextOwner = _.get(row, 'owner');
            // log.debug(`Next owner for ${JSON.stringify(row, null, 4)} is: ${nextOwner}`);
            if (!_.isEmpty(nextOwner) && nextOwner === record['owner']) {
              log.debug(`Found match: ${JSON.stringify(row, null, 4)}`);
              md2['contributor_ci']['email'] = row['email'];
              const logMessage = `CI without email: using owner: ${record['owner']} with email: ${row['email']}`;
              log.info(`4a. ${logMessage}`);
              report('validate', '', 'contributor_ci', logMessage, '');
              const e = new Error(csvParserErrorOK);
              parser.destroy(e);
            }
          }).on('close', function () {
            log.debug("Got to end of parsing through close...");
          });
          readStream.on('close', function () {
            log.debug("Got to end of reading through close...");
          });
          const pipeline = util.promisify(stream.pipeline);
          await pipeline(readStream, parser);
        } catch (error) {
          if (error.message != csvParserErrorOK) {
            log.warn("Problem reading record owners csv file. Ending csv search prematurely.");
            log.error(error);
            log.error('5. failed CI email check.');
            report('validate', '', 'contributor_ci', `CI without email and no matching record owner for: ${record['owner']}. No CI email recorded.`, '');
            log.warn('Skipping to next record...');
            continue;
          } else {
            log.debug('Parser was closed OK (probably because it found a match).');
      }
        }
        log.debug('CI email replacement completed.');
        log.info(`CI data now is: ${JSON.stringify(md2['contributor_ci'], null, 4)}`);
        log.info(`DM data now is: ${JSON.stringify(_.get(md2, 'contributor_data_manager'), null, 4)}`);
      }
      const errors = validate(record['owner'], cw['required'], md2, report);
      console.log('Record owner is');
      console.dir(_.get(record, 'owner'));
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
        log.warn('6. No dest.');
        continue;
      }
      log.info('6. dest present. continuing');
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
        const perms = await setpermissions(rbSource, rbDest, noid, oid, md2, cw['permissions']);
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
        let mdPub = await rbSource.getRecord(oid);
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
      if (!_.isEmpty(record['attachments'])) {
        try {
          const result = await uploadAttachments(rbSource, rbDest, noid, oid, record, md2, pubOid, md2Pub, report);
          if (!result) {
            console.log('No result!!!');
            throw('unknown error');
          }
          if ('error' in result) {
            console.log('error in result');
            console.dir(result);
            throw(result['error']);
          }
          log.info('12. Successfully uploaded attachments.');
        } catch (e) {
          console.error('12. There was an error in uploading attachments.');
          console.error(e);
          report('attachments', '', '', 'failed', e);
        }
      } else {
        log.info(`12. No attachments for record: ${oid}`);
      }
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

async function pauseMigration(override = undefined) {
  const waitPeriod = !_.isEmpty(override) ? override : _.get(args, 'wait');
  console.dir(waitPeriod);
  if (!_.isEmpty(waitPeriod)) {
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

async function setpermissions(rbSource: Redbox, rbDest: Redbox, noid: string, oid: string, md2: Object, pcw: Object): Promise<Object> {
  var perms = await rbSource.getPermissions(oid);
  var nperms = {view: [], edit: []};
  if (!perms) {
    perms = {view: [], edit: []};
  }
  const users = await usermap(rbSource, oid, md2, pcw);
  for (const cat in users) {
    for (const user in users[cat]) {
      for (const p in pcw[cat]) {
        if (!(user in perms[p])) {
          perms[p].push(user);
        }
      }
    }
    ['view', ' edit'].map((p) => perms[p] = _.union(perms[p], nperms[p]));
  }
  log.debug("Permissions:");
  log.info(JSON.stringify(perms));
  try {
    const view = await rbDest.grantPermission(noid, 'view', perms['view']);
    const edit = await rbDest.grantPermission(noid, 'edit', perms['edit']);
    return {'success': true};
  } catch (e) {
    throw e;
  }
}

async function uploadAttachments(rbSource: Redbox, rbDest: Redbox, noid: string, oid: string, redbox1Record: Object, redbox2Record: Object, pubOid: string, redbox2PubRecord: Object, reportFn: any): Promise<Object> {
  const magicFileBytesMaxSize = 104857600;

  // guessing that it is better to call redbox2 (ie: redbox2 can handle the traffic) for each attachment rather than trying to send all attachments at once (in case any attachment is large)
  log.info('Fetching and uploading any attachments...');
  log.verbose(`Have ${redbox1Record['attachments'].length} attachments...`);
  let dataLocations = redbox2Record['dataLocations'] || [];
  let errors = [];
  for (const attachment of redbox1Record['attachments']) {
    // log.verbose('Next attachment to fetch:', JSON.stringify(attachment));
    // ensure data returned is a stream - the default, string, will corrupt binary data - so can send straight on to upstream
    const id = attachment.attachId;
    const filename = encodeURIComponent(attachment.attachFilename);
    log.verbose(`next attachment filename is: ${filename}`);
    const data = await rbSource.readDatastream(id, filename, {responseType: 'stream'});
    if (_.get(data, 'statusCode') != '200') {
      log.warn(`Attachment read datastream failed for ${JSON.stringify(attachment)}. Skipping this iteration...`);
      errors.push({'message': 'No get nor write datastream result', oid: noid, attachment: JSON.stringify(attachment)});
      continue;
    }
    log.verbose('Have Redbox1 attachment data. Sending upstream...');
    log.verbose(`Received data type is: ${typeof data}`);
    log.info('Fetching attachment workflow metadata...');
    let workflowMetadata = await rbSource.readDatastream(id, "workflow.metadata", {});
    if (_.isEmpty(workflowMetadata)) {
      log.info("Problem finding 'workflow.metadata'. Trying 'attachments.metadata' instead...");
      workflowMetadata = await rbSource.readDatastream(id, "attachments.metadata", {});
    }
    log.verbose(JSON.stringify(workflowMetadata));
    if (_.isEmpty(workflowMetadata)) {
      log.info("There was a problem finding both 'workflow.metadata' and 'attachments.metadata'");
    }
    let form = new FormData();
    form.append('attachmentFields', data);
    log.info('Waiting for upload to complete...');
    const result = await (<Redbox2>rbDest).writeDatastreams(noid, form, {
      maxContentLength: magicFileBytesMaxSize,
      headers: {...form.getHeaders(),}
    });
    if (!result || !_.has(result, 'message')) {
      log.warn("No result received. Sending to errors");
      errors.push({'message': 'No write datastream result', oid: noid, attachment: JSON.stringify(attachment)});
    } else {
      log.debug(JSON.stringify(result));
      log.debug('Completed next upload. Updating metadata....');
      const resultMessage = result['message'];
      if (resultMessage['code'] != '200' || resultMessage['oid'] != noid || resultMessage['fileIds'].length != 1) {
        // allow other pending attachments to succeed - only throw errors after all attachments attempted to upload
        log.warn("Result was not successful. Sending to errors.");
        errors.push(JSON.stringify(result));
      } else {
        const fileId = resultMessage.fileIds[0];
        const location = `${resultMessage.oid}/attach/${fileId}`;
        let nextLocation = _.omitBy({
          type: 'attachment',
          location: location,
          name: attachment.attachFilename,
          fileId: fileId,
          uploadUrl: `${rbDest.baseURL}/record/${location}`,
          notes: _.get(workflowMetadata, 'formData.fileDescription'),
          accessRights: _.get(workflowMetadata, 'formData.access_rights'),
          attachmentType: _.get(workflowMetadata, 'formData.attachment_type')
        }, _.isEmpty);
        // console.log('built next data location:');
        // console.dir(nextLocation);
        dataLocations.push(nextLocation);
        // report on each successful upload, so upload errors, only, can be thrown afterwards.
        try {
          // update data location for Redbox2 dataRecord metadata: dataLocations
          redbox2Record['contractualObligations_licences'] = dataLocations;
          const metadataResult = await rbDest.updateRecordMetadata(noid, redbox2Record);
          log.verbose('Metadata update result is: ', metadataResult);
          // update data location for Redbox2 dataPublication metadata: dataLocations
          redbox2PubRecord['contractualObligations_licences'] = dataLocations;
          const metadataPubResult = await rbDest.updateRecordMetadata(pubOid, redbox2PubRecord);
          log.verbose('Metadata publication update result is: ', metadataPubResult);
          let metaMetadataObject = await rbDest.getRecordMetadata(noid);
          metaMetadataObject['attachmentFields'] = ["contractualObligations_licences"];
          log.verbose('Uploading metaMetadata: ');
          // log.verbose(JSON.stringify(metaMetadataObject));
          const updateMetaMetaDataResult = await (<Redbox2>rbDest).updateRecordObjectMetadata(noid, metaMetadataObject);
          reportFn('attachments', '', '', 'set', JSON.stringify(result));
        } catch (error) {
          log.error("There was a problem updating record metadata", error)
          errors.push({noid: error});
        }
      }
    }
  }
  if (!_.isEmpty(errors)) {
    throw new Error(`There was a problem uploading 1 or more attachments for: ${noid}: ${JSON.stringify(errors)}`);
  } else {
    log.info(`All upload attachments successfully completed for ${oid}`);
    return {'success': true};
  }
}


// build a dict of user categories (ie contributor_ci) to lists of user IDs

async function usermap(rbSource: Redbox, oid: string, md2: Object, pcw: Object): Promise<{ [cat: string]: [string] }> {
  var users = {};

  const id_field = pcw['user_id'];

  for (var c in pcw['permissions']) {
    if (c === '_owner') {
      const oldperms = await rbSource.getPermissions(oid);
      users[c] = [oldperms['edit'][0]];
    } else if (c in md2) {
      if (Array.isArray(md2[c])) {
        users[c] = md2[c].map((u) => u[id_field])
      } else {
        users[c] = [md2[c][id_field]];
      }
    }
  }
  return users;
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
  await fs.outputFile(fn, csvstr);
  log.info('Report done.');
}


async function main(args) {

  const timestamp = Date.now().toString();
  const name = args['crosswalk'] || 'all';
  const outdir = path.join(args['outdir'], `report_${name}_${timestamp}`);

  if (!(args['crosswalk'] || args['index'])) {
    info(args['source']);
  } else {

    var [records, errors] = await index(args);
    await writeerrors(errors, path.join(outdir, `errors_${timestamp}.csv`));

    if (args['crosswalk']) {
      const [updated_records, report] = await migrate(args, outdir, records);
      await writeindex(updated_records, path.join(outdir, `index_${timestamp}.csv`));
      await writereport(report, path.join(outdir, `report_${timestamp}.csv`));
    } else {
      await writeindex(records, path.join(outdir, `index_${timestamp}.csv`));
    }
  }
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
    defaultValue: null
  }
);

parser.addArgument(
  ['-s', '--source'],
  {
    help: 'ReDBox server to migrate records from.',
    defaultValue: 'Test1_9'
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

