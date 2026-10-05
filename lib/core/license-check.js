/**
 * Enterprise License Validator
 */
const validateLicense = (key) => {
  // Authorized keys for your enterprise product
  const validKeys = ['BEAST-PRO-2026', 'BEAST-ENT-2026'];
  return validKeys.includes(key);
};
module.exports = { validateLicense };


