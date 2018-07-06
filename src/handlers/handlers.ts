
// Pluggable field handlers

import { LogCallback } from '../types';

export interface Handler {

	logger: LogCallback;
	params: Object; 

	crosswalk(orig: Object): Object; 

}

export abstract class HandlerBase {

	logger: LogCallback;
	params: Object; 

	constructor(l: LogCallback, p?: Object) {
		this.logger = l;
		if( p ) {
			this.params = p;
		} else {
			this.params = {};
		}
	}

	abstract crosswalk(orig: object): Object;

}


const hreg: { [ id: string ]: string } = {};


// export function register_handler(id: string, classname: string) {
// 	hreg{id} = classname;
// }

// export function make_handler(id: string, l: LogCallback): Handler {
// 	if( id in hreg ) {
// 		const classname = hreg[id];
		
// 	}
// }
