// FundingBody handler

import {Handler, HandlerBase} from './handlers';
import * as striptags from 'striptags';

export class HTMLLessDescription extends HandlerBase implements Handler {

	crosswalk(o: any): string | undefined {

		const stripped = striptags(o, ['a'], '\n');

		return stripped;

	}

}
