// GrantBody handler

import {Handler, HandlerBase} from './handlers';
import * as _ from 'lodash';

export class GrantBody extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {
    let title = o['dc_title'];
    let repository_name = 'Research Activities';
    const matches = title.match(/^\((.*)\)[\s]*(.+)$/);
    if (matches && matches[1]) {
      repository_name = matches[1];
      if (matches[2]) {
        title = matches[2];
      }
    }
    if (!_.isEmpty(title)) {
      return {
        'dc_title': title,
        'dc_identifier': [o ['dc_identifier']],
        'grant_number': [o['grant_number']],
        'repository_name': [
          repository_name
        ]
      };
    }
  }

}
