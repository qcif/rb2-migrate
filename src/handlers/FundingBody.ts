// FundingBody handler

import {Handler, HandlerBase} from './handlers';
import * as _ from 'lodash';

export class FundingBody extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {
    let title = o['dc_title'];
    let repository_name = 'Funding Bodies';
    const matches = title.match(/^\((.*)\)[\s]*(.+)$/);
    if (matches && matches[1]) {
      repository_name = matches[1];
      if (matches[2]) {
        title = matches[2];
      }
    }
    if (!_.isEmpty(title)) {
      return {
        'dc_title': o['dc_title'],
        'dc_identifier': [o ['dc_identifier']],
        'repository_name': [
          'Funding Bodies'
        ]
      };
    }
  }

}
