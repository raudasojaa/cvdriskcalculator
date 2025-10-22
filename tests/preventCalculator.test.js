const assert = require('assert');
const { calculatePreventTotalCvd, convertCholesterolToMmol } = require('../risk-core');

function round(value) {
  return Math.round(value * 10000) / 10000;
}

const cases = [
  {
    description: 'Female, mmol/L inputs',
    input: {
      sex: 'female',
      age: 60,
      systolic: 120,
      totalChol: 5.2,
      hdl: 1.4,
      smoker: 'no',
      diabetes: 'no',
      bpMedicated: 'no',
      statin: 'no',
      egfr: 90,
    },
    expected: 0.0423,
  },
  {
    description: 'Male, mg/dL inputs automatically converted',
    input: {
      sex: 'male',
      age: 55,
      systolic: 135,
      totalChol: 210,
      hdl: 48,
      smoker: 'yes',
      diabetes: 'no',
      bpMedicated: 'yes',
      statin: 'no',
      egfr: 70,
    },
    expected: 0.1053,
  },
  {
    description: 'Conversion helper leaves mmol/L unchanged',
    conversionInput: 4.7,
    expectedConversion: 4.7,
  },
  {
    description: 'Conversion helper converts mg/dL to mmol/L',
    conversionInput: 200,
    expectedConversion: 5.172,
  },
];

let passed = 0;

cases.forEach((testCase) => {
  if (testCase.input) {
    const result = calculatePreventTotalCvd(testCase.input);
    assert.strictEqual(round(result), testCase.expected, testCase.description);
  } else {
    const converted = convertCholesterolToMmol(testCase.conversionInput);
    assert.strictEqual(round(converted), round(testCase.expectedConversion), testCase.description);
  }
  passed += 1;
});

console.log(`All ${passed} PREVENT calculator tests passed.`);
