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
