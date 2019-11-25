import {Handler, HandlerBase} from './handlers';

export class Custodian extends HandlerBase implements Handler {

  crosswalk(o: Object): Object | undefined {
    const result = {};
    result['custodian'] = {};
    for (const dest of this.config['destinations']) {
      result['custodian'][dest["to"]] = o;
    }
    return result;
  }
}
