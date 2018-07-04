
// Pluggable field handlers


export type LogCallback = (stage: string, field: string, nfield: string, msg: string, value: any) => void; 



export interface Handler {

	logger LogCallback;
	id: string;
	crosswalk(orig: Object):Object; 


}

export class HandlerBase {

	constructor(l: LogCallback, id: string) {
		this.logger = l;
		this.id = id;
	}


}


const hreg: { [ id: string ]: string } = {};


export function register_handler(id: string, classname: string) {
	hreg{id} = classname;
}

export function make_handler(id: string, l: LogCallback): Handler {
	if( id in hreg ) {
		return new 
	}
}
