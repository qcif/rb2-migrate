/*
* Test: Inject 1 object into redbox 2 using crosswalk and redbox1
*       Use process.env.aRecord to grab a record from redbox1 to migrate.
* Author: Moises Sacal <moisbo@gmail.com>
*/

import {Redbox1, Redbox2} from '../src/Redbox';
import * as path from 'path';
import * as fs from 'fs-extra';
import {expect} from 'chai';
import * as assert from 'assert';

import 'mocha';
import {crosswalk} from "../src/crosswalk";
import {postwalk} from "../src/postwalk";

const config = require('config');
const source = 'redbox1';
const server = source;
const cf = config.get('servers.' + server);

const dmpt = process.env.rdmpt || 'dmpt';
const dataset = process.env.dataset || 'dataset';
const dataRecord = process.env.selfSubmission || 'dataRecord';
const rdmp = process.env.rdmp || 'rdmp';

const rbSource = new Redbox1(cf);

const server2 = 'redbox2';
const cf2 = config.get('servers.' + server2);
const rbDest = new Redbox2(cf2);


describe('insert dmpt into rb2:rdmp', () => {

	const aRecord = process.env.aRecord;
	assert.notEqual(aRecord, undefined, 'Define a record <aRecord> with environment variable as process.env.aRecord');

	let cw: any;
	let md: any;
	let res: any;
	let mdu: any;
	let md2: any;

	let report = [['oid', 'stage', 'ofield', 'nfield', 'status', 'value']];
	const logger = (stage, ofield, nfield, msg, value) => {
		report.push([aRecord, stage, ofield, nfield, msg, value]);
	};

	beforeEach(async () => {
		try {
			const cwf = path.join(config.get("crosswalks"), dmpt + '.json');
			cw = await fs.readJson(cwf);
			assert.notEqual(cw, undefined, 'could not crosswalk from file');
			md = await rbSource.getRecord(aRecord);
			assert.notEqual(md, undefined, 'could not getRecord from rbSource');
			res = await crosswalk(cw, md, logger);
			mdu = res[0];
			md2 = res[1];
			assert.notEqual(mdu, undefined, 'could not unflatten crosswalk from rbSource');
			assert.notEqual(md2, undefined, 'could not crosswalk from rbSource');
		} catch (e) {
			assert.notEqual(e, undefined, e);
			process.exit(1);
		}
	});


	it('should insert rdmp record', async () => {
		const dest_type = rdmp;
		const noid = await rbDest.createRecord(md2, dest_type);
		console.log(noid);
		expect(noid).to.not.equal(undefined);
	});

});

describe('insert dataset into rb2:dataRecord', () => {

	const aRecord = process.env.aRecord;
	assert.notEqual(aRecord, undefined, 'Define a record <aRecord> with environment variable as process.env.aRecord');

	let cw;
	let md;
	let [mdu, md2] = [{}, {}];

	let report = [['oid', 'stage', 'ofield', 'nfield', 'status', 'value']];
	const logger = (stage, ofield, nfield, msg, value) => {
		report.push([aRecord, stage, ofield, nfield, msg, value]);
	};

	beforeEach(async () => {
		const cwf = path.join(config.get("crosswalks"), dataset + '.json');
		cw = await fs.readJson(cwf);
		assert.notEqual(cw, undefined, 'could not crosswalk from file');
		md = await rbSource.getRecord(aRecord);
		assert.notEqual(md, undefined, 'could not getRecord from rbSource');
		const res = crosswalk(cw, md, logger);
		mdu = res[0];
		md2 = res[1];
		assert.notEqual(mdu, undefined, 'could not unflatten crosswalk from rbSource');
		assert.notEqual(md2, undefined, 'could not crosswalk from rbSource');
	});


	it('should insert record', async () => {
		const dest_type = dataRecord;
		const noid = await rbDest.createRecord(md2, dest_type);
		expect(noid).to.not.equal(undefined);
	});

});

describe('should insert all <workflow_steps> into a destination type', () => {
	let cw;
	let md;
	let res: any;
	let mdu: any;
	let md2: any;

	let report = [['oid', 'stage', 'ofield', 'nfield', 'status', 'value']];
	const workflowStep = 'investigation';
	const packageType = 'dataset';
	const dest_type = dataRecord;

	let list = null;

	beforeEach(async () => {
		list = await rbSource.listByWorkflowStep(packageType, workflowStep);
		const cwf = path.join(config.get("crosswalks"), `${packageType}_${workflowStep}.json`);
		cw = await fs.readJson(cwf);
		assert.notEqual(cw, undefined, 'could not crosswalk from file');

	});

	it('should insert each record into ' + dest_type + ':', async () => {
		const insertedRecords = list.map(async aRecord => {
			const logger = (stage, ofield, nfield, msg, value) => {
				report.push([aRecord, stage, ofield, nfield, msg, value]);
			};
			md = await rbSource.getRecord(aRecord);
			assert.notEqual(md, undefined, 'could not getRecord from rbSource');
			const res = crosswalk(cw, md, logger);
			mdu = res[0];
			md2 = res[1];
			assert.notEqual(mdu, undefined, 'could not unflatten crosswalk from rbSource');
			assert.notEqual(md2, undefined, 'could not crosswalk from rbSource');
			const noid = await rbDest.createRecord(md2, dest_type);
			//const permissions = await rbDest.grantPermission(noid, 'edit', md2['edit']);
			return noid;
		});
		expect(insertedRecords).to.not.be.undefined;
	});

});


describe('insert self-submission-draft into rb2:dataRecord', () => {
	const aRecord = process.env.aRecord;
	assert.notEqual(aRecord, undefined, 'Define a record <aRecord> with environment variable as process.env.aRecord');

	let cw;
	let md;
	let [mdu, md2] = [{}, {}];
	const workflowStep = 'self-submission-draft';
	const packageType = 'self-submission';
	const dest_type = dataRecord;

	let report = [['oid', 'stage', 'ofield', 'nfield', 'status', 'value']];
	const logger = (stage, ofield, nfield, msg, value) => {
		report.push([aRecord, stage, ofield, nfield, msg, value]);
	};

	beforeEach(async () => {
		const cwf = path.join(config.get("crosswalks"), `${packageType}_${workflowStep}.json`);
		cw = await fs.readJson(cwf);
		assert.notEqual(cw, undefined, 'could not crosswalk from file');
		md = await rbSource.getRecord(aRecord);
		assert.notEqual(md, undefined, 'could not getRecord from rbSource');
		const res = crosswalk(cw, md, logger);
		mdu = res[0];
		md2 = res[1];
		assert.notEqual(mdu, undefined, 'could not unflatten crosswalk from rbSource');
		assert.notEqual(md2, undefined, 'could not crosswalk from rbSource');
	});


	it('should insert record', async () => {
		const noid = await rbDest.createRecord(md2, dest_type);
		const permissions = await rbDest.grantPermission(noid,
			'edit',
			{
				"users": ["moises.sacal@uts.edu.au"],
				"pendingUsers": ["moises.sacal@uts.edu.au"]
			});
		permissions;
		expect(noid).to.not.equal(undefined);
	});

});

describe('insert dataset_metadata-review into rb2:dataRecord', () => {

	const aRecord = process.env.aRecord;
	assert.notEqual(aRecord, undefined, 'Define a record <aRecord> with environment variable as process.env.aRecord');

	let cw;
	let md;
	let [mdu, md2] = [{}, {}];
	const workflowStep = 'metadata-review';
	const packageType = 'dataset';
	const dest_type = dataRecord;

	let report = [['oid', 'stage', 'ofield', 'nfield', 'status', 'value']];
	const logger = (stage, ofield, nfield, msg, value) => {
		report.push([aRecord, stage, ofield, nfield, msg, value]);
	};

	beforeEach(async () => {
		const cwf = path.join(config.get("crosswalks"), `${packageType}_${workflowStep}.json`);
		cw = await fs.readJson(cwf);
		assert.notEqual(cw, undefined, 'could not crosswalk from file');
		md = await rbSource.getRecord(aRecord);
		assert.notEqual(md, undefined, 'could not getRecord from rbSource');
		const res = crosswalk(cw, md, logger);
		mdu = res[0];
		md2 = res[1];
		assert.notEqual(mdu, undefined, 'could not unflatten crosswalk from rbSource');
		assert.notEqual(md2, undefined, 'could not crosswalk from rbSource');
	});


	it('should insert record', async () => {
		const noid = await rbDest.createRecord(md2, dest_type);
		const permissions = await rbDest.grantPermission(noid,
			'edit',
			{
				"users": ["moises.sacal@uts.edu.au"],
				"pendingUsers": ["moises.sacal@uts.edu.au"]
			});
		permissions;
		expect(noid).to.not.equal(undefined);
	});

});

describe('insert dataset_live into rb2:dataRecord then into rb2:dataPublications', () => {

	const aRecord = process.env.aRecord;
	assert.notEqual(aRecord, undefined, 'Define a record <aRecord> with environment variable as process.env.aRecord');

	let cw;
	let md;
	let [mdu, md2] = [{}, {}];
	const workflowStep = 'live';
	const packageType = 'dataset';
	const dest_type = dataRecord;
	const pub_dest_type = 'dataPublication';
	let recordMeta = {};

	let noid = null;
	let report = [['oid', 'stage', 'ofield', 'nfield', 'status', 'value']];
	const logger = (stage, ofield, nfield, msg, value) => {
		report.push([aRecord, stage, ofield, nfield, msg, value]);
	};

	let cwPub, mdPub, mduPub, md2Pub = null;

	before(async () => {
		const cwf = path.join(config.get("crosswalks"), `${packageType}_${workflowStep}.json`);
		cw = await fs.readJson(cwf);
		assert.notEqual(cw, undefined, 'could not crosswalk from file');
		md = await rbSource.getRecord(aRecord);
		assert.notEqual(md, undefined, 'could not getRecord from rbSource');
		const res = crosswalk(cw, md, logger);
		mdu = res[0];
		md2 = res[1];
		assert.notEqual(mdu, undefined, 'could not unflatten crosswalk from rbSource');
		assert.notEqual(md2, undefined, 'could not crosswalk from rbSource');

		const cwfPub = path.join(config.get("crosswalks"), `${packageType}_${workflowStep}.publication.json`);
		cwPub = await fs.readJson(cwfPub);
		assert.notEqual(cwPub, undefined, 'could not crosswalk from file');
		mdPub = await rbSource.getRecord(aRecord);
		assert.notEqual(mdPub, undefined, 'could not getRecord from rbSource');
		const resPub = crosswalk(cwPub, mdPub, logger);
		mduPub = resPub[0];
		md2Pub = resPub[1];
		assert.notEqual(mduPub, undefined, 'could not unflatten crosswalk from rbSource');
		assert.notEqual(md2Pub, undefined, 'could not crosswalk from rbSource');
	});


	it('should insert record', async () => {
		noid = await rbDest.createRecord(md2, dest_type);
		expect(noid).to.not.equal(undefined);
	});

	it('should run post crosswalk', async () => {
		recordMeta = await rbDest.getRecord(noid);
		assert.notEqual(recordMeta, undefined, 'could not get Record from rbDest');
		const newRecordMeta = postwalk(cw['postTasks'], recordMeta, logger);
		const enoid = await rbDest.updateRecordMetadata(noid, newRecordMeta);
		expect(enoid['oid']).to.equal(noid);
	});

	it('should insert a data publication if its a workflowStep:live', async () => {
		// with noid auto populate data publication
		md2Pub['dataRecord'] = {
			oid: noid,
			title: recordMeta['title']
		};
		const pubOid = await rbDest.createRecord(md2Pub, pub_dest_type);
		// then after fill up the rest of the available data from original dataset:live
		expect(pubOid).to.not.equal(undefined);
	});

	it('should add permissions', async () => {
		const permissions = await rbDest.grantPermission(noid,
			'edit',
			{
				"users": ["moises.sacal@uts.edu.au"],
				"pendingUsers": ["moises.sacal@uts.edu.au"]
			});
		expect(permissions).to.not.equal(undefined);
	});

});
