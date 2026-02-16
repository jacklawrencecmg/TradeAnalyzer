/**
 * ESLint Rule: no-fdp-math
 *
 * Prevents arithmetic operations on FDP values.
 * FDP values are immutable and cannot be modified or recalculated.
 *
 * Banned:
 * - fdp.value * 2
 * - fdp.value + 100
 * - fdp.value / scale
 * - Math.round(fdp.value)
 * - (fdp1.value + fdp2.value) / 2  [averaging]
 *
 * Allowed:
 * - fdp1.value > fdp2.value  [comparison]
 * - fdp1.value - fdp2.value  [difference for display]
 * - formatFDPValue(fdp.value)
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow arithmetic operations on FDP values',
      category: 'FDP Policy',
      recommended: true,
    },
    messages: {
      noFdpMath: 'Arithmetic operations on FDP values are forbidden. FDP values are immutable. Use formatFDPValue() for display.',
      noFdpRounding: 'Rounding FDP values is forbidden. Use formatFDPValue() for display.',
      noFdpScaling: 'Scaling FDP values is forbidden. FDP values cannot be modified.',
      noFdpAveraging: 'Averaging FDP values is forbidden. FDP values cannot be combined or recalculated.',
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.getSourceCode();

    function isFdpValueAccess(node) {
      // Check if accessing fdp.value or bundle.value where type is FDPValueBundle
      if (node.type === 'MemberExpression') {
        const objectName = node.object.name;
        const propertyName = node.property.name;

        // Common FDP variable names
        const fdpVarNames = ['fdp', 'bundle', 'fdpValue', 'fdpBundle'];

        if (
          fdpVarNames.includes(objectName) &&
          propertyName === 'value'
        ) {
          return true;
        }
      }

      return false;
    }

    function checkBinaryExpression(node) {
      const left = node.left;
      const right = node.right;
      const operator = node.operator;

      // Allowed: comparison operators
      const allowedOps = ['>', '<', '>=', '<=', '==', '===', '!=', '!=='];

      if (allowedOps.includes(operator)) {
        return; // Comparison is OK
      }

      // Check for arithmetic on FDP values
      const arithmeticOps = ['+', '-', '*', '/', '%', '**'];

      if (arithmeticOps.includes(operator)) {
        // Check if either side is FDP value access
        if (isFdpValueAccess(left) || isFdpValueAccess(right)) {
          // Special case: subtraction for difference calculation
          if (operator === '-') {
            // Check if this is inside a comparison or display context
            const parent = node.parent;

            // Allow: fdp1.value - fdp2.value (for difference display)
            if (
              parent.type === 'CallExpression' ||
              parent.type === 'ReturnStatement' ||
              parent.type === 'VariableDeclarator'
            ) {
              return; // Allowed for difference calculation
            }
          }

          context.report({
            node,
            messageId: 'noFdpMath',
          });
        }
      }
    }

    function checkCallExpression(node) {
      const callee = node.callee;

      // Check for Math operations on FDP values
      if (
        callee.type === 'MemberExpression' &&
        callee.object.name === 'Math'
      ) {
        const mathOp = callee.property.name;
        const roundingOps = ['round', 'floor', 'ceil', 'trunc'];

        if (roundingOps.includes(mathOp)) {
          // Check if argument is FDP value
          const arg = node.arguments[0];
          if (arg && isFdpValueAccess(arg)) {
            context.report({
              node,
              messageId: 'noFdpRounding',
            });
          }
        }
      }

      // Check for .toFixed() on FDP values
      if (
        callee.type === 'MemberExpression' &&
        callee.property.name === 'toFixed' &&
        isFdpValueAccess(callee.object)
      ) {
        context.report({
          node,
          messageId: 'noFdpRounding',
        });
      }
    }

    return {
      BinaryExpression: checkBinaryExpression,
      CallExpression: checkCallExpression,
    };
  },
};
