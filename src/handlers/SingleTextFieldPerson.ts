import {Handler} from './handlers';
import * as _ from 'lodash';
import {Person} from "./Person";

export class SingleTextFieldPerson extends Person implements Handler {

  buildIdentiferOutput(o: Object, output: Object): Object | undefined {
    if (!o["fullname"]) {
      return undefined;
    }
    return _.assign(output, {
      text_full_name: o["fullname"],
    });
  }

  getFeedback(output: Object): Object | undefined {
    this.logger('handler', "Person", output['role'], "succeeded", JSON.stringify(output));
    return output;
  }
}
