// FundingBody handler

import {Handler, HandlerBase} from './handlers';
import * as striptags from 'striptags';
import {htmlDescriptionFilter} from '../utils/helpers'

export class HTMLLessDescription extends HandlerBase implements Handler {

	crosswalk(o: any): string | undefined {
		const strippedForNewLine = striptags(o, htmlDescriptionFilter, '\n');
		// ensure html tags don't remain in text
		const stripped = striptags(strippedForNewLine);
		return stripped;

	}

}
