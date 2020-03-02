import {Handler, HandlerBase} from './handlers';

export class ApplicationCustodian extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {
    const result = {};
    result['ApplicationCustodian'] = {};
    for (const dest of this.config['destinations']) {
      result['ApplicationCustodian'][dest["to"]] = o;
    }
    console.dir(result);
    return result;
  }
}
