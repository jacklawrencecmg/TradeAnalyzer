/**
 * ESLint Rule: no-direct-value-queries
 *
 * Prevents direct queries to value tables outside of getFDPValue.ts
 * Enforces use of canonical FDP value interface
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct queries to player value tables',
      category: 'FDP Canonical Values',
      recommended: true,
    },
    messages: {
      directValueQuery:
        'Direct queries to value tables are prohibited. Use getFDPValue() or getFDPValuesBatch() from src/lib/fdp/getFDPValue.ts instead.',
      directValueImport:
        'Direct imports of value data are prohibited. Use the FDP value interface.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();
    const isGetFDPValueModule = filename.includes('getFDPValue.ts');
    const isTestFile = filename.includes('.test.') || filename.includes('.spec.');

    if (isGetFDPValueModule || isTestFile) {
      return {};
    }

    const prohibitedTableNames = [
      'latest_player_values',
      'player_value_history',
      'player_values',
      'ktc_value_snapshots',
    ];

    const prohibitedColumns = [
      'value',
      'base_value',
      'ktc_value',
      'fdp_value',
      'dynasty_value',
      'redraft_value',
    ];

    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'from'
        ) {
          const argument = node.arguments[0];
          if (argument && argument.type === 'Literal') {
            const tableName = argument.value;
            if (prohibitedTableNames.includes(tableName)) {
              context.report({
                node,
                messageId: 'directValueQuery',
              });
            }
          }
        }

        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'select'
        ) {
          const argument = node.arguments[0];
          if (argument && argument.type === 'Literal') {
            const selectClause = argument.value;
            const hasProhibitedColumn = prohibitedColumns.some(col =>
              selectClause.includes(col)
            );
            if (hasProhibitedColumn && selectClause.includes('value')) {
              context.report({
                node,
                messageId: 'directValueImport',
              });
            }
          }
        }
      },

      ImportDeclaration(node) {
        if (node.source.value.includes('player_values')) {
          context.report({
            node,
            messageId: 'directValueImport',
          });
        }
      },
    };
  },
};
