const clampProbability = (value) => {
  if (Number.isNaN(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

const riskModels = {
  finrisk: {
    /**
     * Calculates the combined cardiovascular risk for FINRISK inputs.
     * @param {Object} params
     * @param {number} params.coronaryRisk - Coronary heart disease risk (0-1).
     * @param {number} params.strokeRisk - Stroke risk (0-1).
     * @returns {number} Combined risk probability clamped between 0 and 1.
     */
    calculate({ coronaryRisk = 0, strokeRisk = 0 } = {}) {
      const coronary = Number.isFinite(coronaryRisk) ? coronaryRisk : 0;
      const stroke = Number.isFinite(strokeRisk) ? strokeRisk : 0;

      const combinedRisk = coronary + stroke;

      return clampProbability(combinedRisk);
    },
  },
};

module.exports = {
  clampProbability,
  riskModels,
};
