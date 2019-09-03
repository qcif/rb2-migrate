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
  console.log(`country code is: ${countryCode}`)
  // readFile('resources/countrycodes.json', 'utf-8', (err, fileContent) => {
  //   if (err) {
  //     console.log(err); // Do something to handle the error or just throw it
  //     throw new Error(err);
  //   }
  //
  //   console.log('have json file content...');
  //   console.dir(fileContent);
  // });

  const countryJson = fs.readJsonSync('resources/countrycodes.json', {encoding: 'utf-8'})
  console.dir(countryJson[countryCode]) // => 2.0.0
  return _.get(countryJson, countryCode, '');
  // fs.createReadStream('resources/countrycodes.json', {encoding: 'utf-8'})
  //   .pipe(JSONStream.parse('rows.*.doc'))
  //   .on('data', function (doc) {
  //     console.log('json doc is ');
  //     console.dir(doc);
  //   }).on('error', function (err) {
  //   console.log(err); // Do something to handle the error or just throw it
  //   throw new Error(err);
  // });

}

export {
  htmlDescriptionFilter
}
