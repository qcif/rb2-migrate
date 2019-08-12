import {Handler, HandlerBase} from './handlers';
import {isEmailValid, decodeEmail} from "../utils/helpers";
import * as _ from 'lodash';
import {Person} from "./Person";

// Use the 'fields' clause in the crosswalk JSON file to map the
// fields in your rb1.x records to the above keys: this will be
// done before the Person handler is used to crosswalk the
// records.

export class AccessPerson extends HandlerBase implements Handler {
  crosswalk(o: Object): Object | undefined {
    let repeatable: boolean = o['repeatable'] || false;
    const output = this.buildIdentiferOutput(o, {
      role: this.config["role"],
      repeatable: repeatable
    });
    if (!output) {
      return undefined;
    }
    if (this.config['destinations']) {
      const defaultRole = this.config["defaultRole"];
      const defaultField = this.config["defaultField"];
      let outputs = this.buildDestinations(o, output);
      return outputs;
    } else {
      return this.getFeedback(output);
    }
  }

  buildDestinations(o: Object, output: Object): object {
    if (this.config['destinations']) {
      const defaultRole = this.config["defaultRole"];
      const defaultField = this.config["defaultField"];
      let outputs = {};
      for (let dest of this.config["destinations"]) {
        const outputPostFeedback = this.getFeedback(output);
        if (outputPostFeedback) {
          const changeOutput = _.cloneDeep(outputPostFeedback);
          changeOutput['repeatable'] = dest['repeatable'];
          changeOutput['singleUse'] = dest['singleUse'];
          if (o[dest['from']] && dest['value'] && o[dest['from']] !== dest['value']) {
            changeOutput['destination'] = defaultField;
            changeOutput['role'] = defaultRole;
          } else {
            changeOutput['destination'] = dest['to'] || defaultField;
            changeOutput['role'] = dest['role'] || defaultRole;
          }
          if (changeOutput['destination'] === 'dataLicensingAccess_manager') {
            outputs[changeOutput['destination']] = changeOutput['text_full_name'];
          } else {
            outputs[changeOutput['destination']] = changeOutput;
            _.unset(changeOutput, 'destination');
          }
        } else {
          console.log("skipping undefined output");
        }
      }
      console.log('access person...');
      console.dir(outputs);
      return outputs;
    }
  }

  buildIdentiferOutput(o: Object, output: Object): Object | undefined {
    const givenName = o["givenname"] || o["given_name"] || '';
    const familyName = o["familyname"] || o["family_name"] || '';
    let fullname = `${givenName.trim()} ${familyName.trim()}`.trim() || o["fullname"] || '';
    if (!(givenName || familyName || fullname)) {
      return undefined;
    }
    const hrif = o["honorific"] || '';
    let honorific = hrif.trim();
    if (honorific) {
      honorific = honorific + ' ';
    }
    let email = decodeEmail(o["email"]);
    email = isEmailValid(email) ? email : '';
    _.assign(output, {
      "dc:identifier": o["dc:identifier"],
      text_full_name: fullname,
      full_name_honorific: honorific + fullname,
      full_name_family_name_first: `${fullname}, ${givenName}`,
      family_name: familyName,
      given_name: givenName,
      email: email
    });
    return output;
  }

  getFeedback(output: Object): Object | undefined {
    if (!output['family_name']) {
      this.logger('handler', "Person", output['role'], "missing", "No familyname for " + JSON.stringify(output));
      return undefined;
    }
    this.logger('handler', "Person", output['role'], "succeeded", JSON.stringify(output));
    if (!output["dc:identifier"]) {
      this.logger('handler', "Person", output['role'], "warning", "No dc:identifier for " + output['text_full_name']);
    }
    return output;

  }
}
