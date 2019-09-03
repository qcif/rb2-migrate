import {Handler, HandlerBase} from './handlers';
import * as _ from 'lodash';
import * as striptags from 'striptags';
import {htmlDescriptionFilter} from "../utils/helpers";

export class HTMLLessFirstFullDescription extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {
    const records = _.castArray(o);
    let firstFull = _.find(records, function (record) {
      return record.type === 'full';
    });
    if (_.isEmpty(firstFull)) {
      firstFull = _.find(records, function (record) {
        return record.type === 'brief';
      });
    }
    if (firstFull) {
      const strippedForNewLine = striptags(firstFull.text, htmlDescriptionFilter, '\n');
      // ensure html tags don't remain in text
      return striptags(strippedForNewLine);
    } else {
      return undefined;
    }
  }
}
