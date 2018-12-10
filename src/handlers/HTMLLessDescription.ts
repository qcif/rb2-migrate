// FundingBody handler

import {Handler, HandlerBase} from './handlers';
import * as striptags from 'striptags';

export class HTMLLessDescription extends HandlerBase implements Handler {

	crosswalk(o: Object): string | undefined {

		const stripped = striptags(o);

		return stripped;

	}

}
