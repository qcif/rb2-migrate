//
// Typescript version of Stash 2 -> 3 migration code
//

import {Redbox, Redbox1, Redbox1Files, Redbox2} from './Redbox';
import {crosswalk, validate} from './crosswalk';
import {ArgumentParser} from 'argparse';
import {postwalk} from './postwalk';
import * as FormData from "form-data";

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
    } else if (cf['version'] === 'Redbox1Files') {
      return new Redbox1Files(cf);
      // } else if (cf['version'] === 'RDA') {
      //   return new RDA(cf);
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
  log.debug(`Sending filter to solr: ${filter}`);
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
  log.debug(`all records attachments are:`);
  console.dir(allRecordsAttachments);
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
  log.info('Showing errors...');
  log.info(errors);
  if (errors) {
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
  // log.debug(JSON.stringify(attachmentsBrief, null, 4));
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

  try {

    for (let record of records) {

      if (args['wait']) {
        const waitPeriod = args['wait'];
        const waited = await sleep(waitPeriod);
        log.debug('continue...');
      }

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
        log.error(`Couldn't get record for ${oid}`);
        updated[oid]['status'] = 'load failed';
        continue;
      }


      updated[oid]['title'] = md['dc:title'];
      updated[oid]['description'] = md['dc:description'];

      const report = (stage, ofield, nfield, msg, value) => {
        report_lines.push([oid, stage, ofield, nfield, msg, value]);
        updated[oid]['status'] = msg + ': ' + value; // status is always last thing
      };
      log.debug('checking for record owner...')
      if (!record['owner']) {
        report('load', '', '', 'no owner', '');
        continue;
      }


      const [mdu, md2] = crosswalk(cw, md, report);
      // console.log('have md2');
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
        continue;
      } else {
        // this will be the last status if we're in dry-run/index mode, so
        // it overwrites any warnings from validate() above
        report('validate', '', '', 'valid', '');
      }
      log.debug('should it continue for dest or args?');
      if (!rbDest || args['index']) {
        continue;
      }

      try {
        log.debug('Creating data record...');
        noid = await rbDest.createRecord(md2, dest_type);
        if (noid) {
          n_created += 1;
          updated[oid]['noid'] = noid;
          report('create', '', '', 'created', noid);
        } else {
          throw('null oid');
        }
      } catch (e) {
        log.info('There was an error.');
        log.info(e);
        report('create', '', '', 'create failed', e);
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
        report('permissions', '', '', 'set', perms);
      } catch (e) {
        report('permissions', '', '', 'failed', e);
      }
      try {
        log.info("Updating Redbox2 data record metaMetadata...");
        let metaMetadataObject = await rbDest.getRecordMetadata(noid);
        metaMetadataObject['legacyId'] = oid;
        log.verbose(JSON.stringify(metaMetadataObject));
        const metaMetadataResult = await (<Redbox2>rbDest).updateRecordObjectMetadata(noid, metaMetadataObject);
        if (!metaMetadataResult) {
          throw('Unknown error in setting metaMetadata.');
        }
        if ('error' in metaMetadataResult) {
          throw(metaMetadataResult['error']);
        }
        report('metaMetaData', 'oid', 'legacyId', 'set', metaMetadataResult);
      } catch (e) {
        report('metaMetaData', 'oid', 'legacyId', 'failed', e);
      }

      if (cw['postTasks']) {
        try {
          recordMeta = await rbDest.getRecord(noid);
        } catch (e) {
          report('postwalk', '', '', 'getRecord failed', e);
          continue;
        }

        try {
          const newRecordMeta = postwalk(cw['postTasks'], recordMeta, report);
          dumpjson(outdir, 'new', oid + '_postwalk', newRecordMeta);
          const enoid = await rbDest.updateRecordMetadata(noid, newRecordMeta);
        } catch (e) {
          report('postwalk', '', '', 'postwalk failed', e);
        }
      }

      if (!cwPub) {
        continue;
      }

      const report_pub = (stage, ofield, nfield, msg, value) => {
        report_lines.push([oid + "_pub", stage, ofield, nfield, msg, value]);
        // FIXME status should get updated too
      };

      let pubOid;
      try {
        let mdPub = await rbSource.getRecord(oid);
        log.info(`Got record ${oid} for publication crosswalk`);
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
        md2Pub["workflowStage"] = cwPub["to_workflow"];
        if (_.get(md2Pub, 'embargoByDate', false)) {
          md2Pub["workflowStage"] = 'embargoed';
        }
        dumpjson(outdir, 'new', oid + '_publication', md2Pub);
        dumpjson(outdir, 'originals', oid + '_pub_unflat', mduPub);
        n_pub += 1;
        log.debug('about to create publication...');
        // console.log(`md2Pub now:`)
        // console.log(md2Pub)
        pubOid = await rbDest.createRecord(md2Pub, cwPub['dest_type']);
        log.debug('completed, create ok.');
        report('published', '', '', 'publication created', '');
      } catch (e) {
        log.error("Publish error: " + e);
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
        } catch (e) {
          console.log('There was an error in uploading attachments.');
          console.log(e);
          report('attachments', '', '', 'failed', e);
        }
      } else {
        log.info(`No attachments for record: ${oid}`);
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
      log.debug(`Found oid: ${oid}`);
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
        dataLocations.push({
          type: 'attachment',
          location: location,
          name: attachment.attachFilename,
          fileId: fileId,
          uploadUrl: `${rbDest.baseURL}/record/${location}`
        });
        // report on each successful upload, so upload errors, only, can be thrown afterwards.
        try {
          // update data location for Redbox2 dataRecord metadata: dataLocations
          redbox2Record['dataLocations'] = dataLocations;
          const metadataResult = await rbDest.updateRecordMetadata(noid, redbox2Record);
          log.verbose('Metadata update result is: ', metadataResult);
          // update data location for Redbox2 dataPublication metadata: dataLocations
          redbox2PubRecord['dataLocations'] = dataLocations;
          const metadataPubResult = await rbDest.updateRecordMetadata(pubOid, redbox2PubRecord);
          log.verbose('Metadata publication update result is: ', metadataPubResult);
          let metaMetadataObject = await rbDest.getRecordMetadata(noid);
          metaMetadataObject['attachmentFields'] = ["dataLocations"];
          log.verbose('Uploading metaMetadata: ');
          log.verbose(JSON.stringify(metaMetadataObject));
          const updateMetaMetaDataResult = await (<Redbox2>rbDest).updateRecordObjectMetadata(noid, metaMetadataObject);
          reportFn('attachments', '', '', 'set', result);
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

