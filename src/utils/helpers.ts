const fs = require('fs-extra');
import * as _ from 'lodash';

export function isEmailValid(email: string) {

  const tester = /^[-!#$%&'*+\/0-9=?A-Z^_a-z{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;

  if (!email) {
    return false;
  }

  if (email.length > 254) {
    return false;
  }

  const valid = tester.test(email);
  if (!valid) {
    return false;
  }

  return true;
}

export function decodeEmail(email) {

  const atEncoded = RegExp('&#64;');
  if (atEncoded.test(email)) {
    let theEmail = email.split('&#64;');
    if (theEmail.length > 0) {
      return `${theEmail[0]}@${theEmail[1]}`;
    } else return email;
  } else return email;
}

const htmlDescriptionFilter = ['a', 'em', 'sub'];


export function getCountryName(countryCode) {
  const countryJson = fs.readJsonSync('resources/countrycodes.json', {encoding: 'utf-8'});
  console.dir(countryJson[countryCode]) // => 2.0.0
  return _.get(countryJson, countryCode, '');
}

export {
  htmlDescriptionFilter
}

export function mergeCustomizer(objValue, srcValue) {
  // if existing object is an array, we want to ensure that its first indicies are not replaced by an incoming (src) array
  if (_.isArray(objValue)) {
    // console.log(`objValue is...`);
    // console.dir(objValue);
    // console.log(`srcValue is`);
    // console.dir(srcValue);
    return objValue.concat(srcValue);
  }
}
