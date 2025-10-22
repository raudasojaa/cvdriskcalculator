(function (globalFactory) {
  const globalObject = typeof globalThis !== 'undefined' ? globalThis : window;
  const exported = globalFactory(globalObject);
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = exported;
  } else {
    globalObject.RiskCore = exported;
  }
})(function () {
  const MGDL_TO_MMOL = 0.02586;
  const CHOLESTEROL_MGDL_THRESHOLD = 20;

  function convertCholesterolToMmol(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return Number.NaN;
    }

    if (numericValue <= 0) {
      return numericValue;
    }

    if (numericValue > CHOLESTEROL_MGDL_THRESHOLD) {
      return numericValue * MGDL_TO_MMOL;
    }

    return numericValue;
  }

  function clampProbability(value) {
    if (Number.isNaN(value)) return 0;
    return Math.min(Math.max(value, 0), 0.95);
  }

  const finriskCoefficients = {
    male: {
      coronary: {
        intercept: 9.081,
        age: 0.075,
        smoking: 0.579,
        totalChol: 0.320,
        systolic: 0.011,
        hdl: 1.082,
        diabetes: 0.729,
        parental: 0.338,
      },
      stroke: {
        intercept: 9.928,
        age: 0.083,
        smoking: 0.369,
        systolic: 0.014,
        hdl: 0.329,
        diabetes: 0.705,
        parental: 0.249,
      },
    },
    female: {
      coronary: {
        intercept: 11.25,
        age: 0.095,
        smoking: 0.639,
        totalChol: 0.244,
        systolic: 0.013,
        hdl: 0.845,
        diabetes: 1.315,
        parental: 0.421,
      },
      stroke: {
        intercept: 9.553,
        age: 0.085,
        smoking: 0.613,
        systolic: 0.012,
        hdl: 0.623,
        diabetes: 0.914,
        parental: 0.023,
      },
    },
  };

  const riskCalculatorCoefficients = {
    female: {
      intercept: -3.307728,
      age: 0.7939329,
      nonHdl: 0.0305239,
      hdl: -0.1606857,
      sbpBelow: -0.2394003,
      sbpAbove: 0.360078,
      diabetes: 0.8667604,
      smoker: 0.5360739,
      egfrBelow: 0.6045917,
      egfrAbove: 0.0433769,
      antiHypertensive: 0.3151672,
      statin: -0.1477655,
      antiHypertensive_sbpAbove: -0.0663612,
      statin_nonHdl: 0.1197879,
      age_nonHdl: -0.0819715,
      age_hdl: 0.0306769,
      age_sbpAbove: -0.0946348,
      age_diabetes: -0.27057,
      age_smoker: -0.078715,
      age_egfrBelow: -0.1637806,
    },
    male: {
      intercept: -3.031168,
      age: 0.7688528,
      nonHdl: 0.0736174,
      hdl: -0.0954431,
      sbpBelow: -0.4347345,
      sbpAbove: 0.3362658,
      diabetes: 0.7692857,
      smoker: 0.4386871,
      egfrBelow: 0.5378979,
      egfrAbove: 0.0164827,
      antiHypertensive: 0.288879,
      statin: -0.1337349,
      antiHypertensive_sbpAbove: -0.0475924,
      statin_nonHdl: 0.150273,
      age_nonHdl: -0.0517874,
      age_hdl: 0.0191169,
      age_sbpAbove: -0.1049477,
      age_diabetes: -0.2251948,
      age_smoker: -0.0895067,
      age_egfrBelow: -0.1543702,
    },
  };

  function calculateFinrisk(inputs) {
    const sex = inputs.sex === 'female' ? 'female' : 'male';
    const coefficients = finriskCoefficients[sex];

    if (!coefficients) {
      throw new Error('Missing FINRISK coefficients for selected sex.');
    }

    const smoker = inputs.smoker === 'yes' ? 1 : 0;
    const diabetes = inputs.diabetes === 'yes' ? 1 : 0;
    const parentInfarction = inputs.parentInfarction === 'yes' ? 1 : 0;
    const parentStroke = inputs.parentStroke === 'yes' ? 1 : 0;

    const age = Number(inputs.age);
    const systolic = Number(inputs.systolic);
    const totalChol = convertCholesterolToMmol(inputs.totalChol);
    const hdl = convertCholesterolToMmol(inputs.hdl);

    const coronary = coefficients.coronary;
    const stroke = coefficients.stroke;

    const coronaryExponent =
      coronary.intercept -
      coronary.age * age -
      coronary.smoking * smoker -
      (coronary.totalChol || 0) * totalChol -
      coronary.systolic * systolic +
      coronary.hdl * hdl -
      coronary.diabetes * diabetes -
      coronary.parental * parentInfarction;

    const strokeExponent =
      stroke.intercept -
      stroke.age * age -
      stroke.smoking * smoker -
      stroke.systolic * systolic +
      stroke.hdl * hdl -
      stroke.diabetes * diabetes -
      stroke.parental * parentStroke;

    const coronaryRisk = 1 / (1 + Math.exp(coronaryExponent));
    const strokeRisk = 1 / (1 + Math.exp(strokeExponent));

    const combinedRisk = 1 - (1 - coronaryRisk) * (1 - strokeRisk);

    return clampProbability(combinedRisk);
  }

  function calculatePreventTotalCvd(inputs) {
    const sex = inputs.sex === 'female' ? 'female' : 'male';
    const coefficients = riskCalculatorCoefficients[sex];

    if (!coefficients) {
      throw new Error('Missing PREVENT Total CVD coefficients for selected sex.');
    }

    const smoker = inputs.smoker === 'yes' ? 1 : 0;
    const diabetes = inputs.diabetes === 'yes' ? 1 : 0;
    const bpMedicated = inputs.bpMedicated === 'yes' ? 1 : 0;
    const statin = inputs.statin === 'yes' ? 1 : 0;

    const age = Number(inputs.age);
    const systolic = Number(inputs.systolic);
    const totalChol = convertCholesterolToMmol(inputs.totalChol);
    const hdl = convertCholesterolToMmol(inputs.hdl);
    const egfr = Number(inputs.egfr);

    if ([age, systolic, totalChol, hdl, egfr].some((value) => !Number.isFinite(value))) {
      throw new Error('Missing or invalid numeric inputs for PREVENT Total CVD calculation.');
    }

    const ageTerm = (age - 55) / 10;
    const nonHdlTerm = totalChol - hdl - 3.5;
    const hdlTerm = (hdl - 1.3) / 0.3;
    const sbpBelowTerm = (Math.min(systolic, 110) - 110) / 20;
    const sbpAboveTerm = (Math.max(systolic, 110) - 130) / 20;
    const egfrBelowTerm = (Math.min(egfr, 60) - 60) / -15;
    const egfrAboveTerm = (Math.max(egfr, 60) - 90) / -15;

    const logOdds =
      coefficients.intercept +
      coefficients.age * ageTerm +
      coefficients.nonHdl * nonHdlTerm +
      coefficients.hdl * hdlTerm +
      coefficients.sbpBelow * sbpBelowTerm +
      coefficients.sbpAbove * sbpAboveTerm +
      coefficients.diabetes * diabetes +
      coefficients.smoker * smoker +
      coefficients.egfrBelow * egfrBelowTerm +
      coefficients.egfrAbove * egfrAboveTerm +
      coefficients.antiHypertensive * bpMedicated +
      coefficients.statin * statin +
      coefficients.antiHypertensive_sbpAbove * bpMedicated * sbpAboveTerm +
      coefficients.statin_nonHdl * statin * nonHdlTerm +
      coefficients.age_nonHdl * ageTerm * nonHdlTerm +
      coefficients.age_hdl * ageTerm * hdlTerm +
      coefficients.age_sbpAbove * ageTerm * sbpAboveTerm +
      coefficients.age_diabetes * ageTerm * diabetes +
      coefficients.age_smoker * ageTerm * smoker +
      coefficients.age_egfrBelow * ageTerm * egfrBelowTerm;

    const risk = Math.exp(logOdds) / (1 + Math.exp(logOdds));

    return clampProbability(risk);
  }

  return {
    clampProbability,
    convertCholesterolToMmol,
    finriskCoefficients,
    riskCalculatorCoefficients,
    calculateFinrisk,
    calculatePreventTotalCvd,
  };
});
