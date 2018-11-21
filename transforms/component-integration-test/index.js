const { getParser } = require('codemod-cli').jscodeshift;
const {
  addImport,
  removeImport,
  removeSpecificImport,
  replaceImportedFunction,
} = require('../../utils/imports');
const { replaceConst } = require('../../utils/const');
const { replaceIdentifier, hasIdentifierCalled } = require('../../utils/identifier');
const {
  findFunction,
  replaceContextualFunctionWithExplicitlyImportedFunction,
} = require('../../utils/function');
const { getNotificationServiceFunctions } = require('../../utils/notifications');

module.exports = function transformer(file, api) {
  const j = getParser(api);

  let code = file.source;

  // remove unused imports
  code = removeImport(j, code, 'embercom/tests/helpers/component-integration-testing');
  // add imports
  code = addImport(j, code, 'module', 'qunit');
  code = addImport(j, code, 'test', 'qunit');
  // template and selectors
  code = replaceConst(j, code, 'TEMPLATE');
  code = replaceConst(j, code, 'SELECTORS');
  // setupRenderingTest
  code = replaceIdentifier(j, code, 'setupTest', 'setupRenderingTest');
  code = addImport(j, code, 'setupRenderingTest', 'ember-qunit');
  // test helpers
  code = replaceIdentifier(j, code, 'keyEvent', 'triggerKeyEvent');
  // feature flags
  code = replaceImportedFunction(
    j,
    code,
    'turnOnFeatures',
    'turnOnFeaturesForApp',
    'embercom/tests/helpers/feature-flag-integration-test-helpers',
  );
  code = replaceImportedFunction(
    j,
    code,
    'turnOffFeatures',
    'turnOffFeaturesForApp',
    'embercom/tests/helpers/feature-flag-integration-test-helpers',
  );
  code = replaceImportedFunction(
    j,
    code,
    'turnOnFeature',
    'turnOnFeatureForApp',
    'embercom/tests/helpers/feature-flag-integration-test-helpers',
  );
  code = replaceImportedFunction(
    j,
    code,
    'turnOffFeature',
    'turnOffFeatureForApp',
    'embercom/tests/helpers/feature-flag-integration-test-helpers',
  );

  // app service
  code = replaceContextualFunctionWithExplicitlyImportedFunction(
    j,
    code,
    'mockAppServiceWithApp',
    [j.thisExpression(), j.identifier('app')],
    'embercom/tests/helpers/mock',
  );

  // attribute service
  code = replaceContextualFunctionWithExplicitlyImportedFunction(
    j,
    code,
    'mockAttributeServiceWithApp',
    [j.thisExpression(), j.identifier('app')],
    'embercom/tests/helpers/mock',
  );

  // app model with data
  code = j(code)
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: {
          type: 'ThisExpression',
        },
        property: {
          name: 'getAppModelWithData',
        },
      },
    })
    .forEach(path => {
      j(path).replaceWith(j.callExpression(j.identifier('getAppModelWithData'), []));
    })
    .toSource();
  if (j(code).find(j.Identifier, { name: 'getAppModelWithData' }).length) {
    code = addImport(j, code, 'getAppModelWithData', 'embercom/tests/helpers/data');
  }

  // factory guy
  if (j(code).find(j.Literal, { value: 'ember-data-factory-guy' }).length) {
    code = addImport(j, code, 'setupFactoryGuy', 'ember-data-factory-guy');
    code = removeSpecificImport(j, code, 'manualSetup');
    code = findFunction(j, code, 'manualSetup')
      .remove()
      .toSource();
    code = findFunction(j, code, 'setupFactoryGuy')
      .remove()
      .toSource();
    code = j(code)
      .find(j.ExpressionStatement, {
        expression: {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            name: 'setupRenderingTest',
          },
        },
      })
      .forEach(path => {
        // hacky way to avoid https://github.com/facebook/jscodeshift/issues/185
        j(path).replaceWith(
          j.expressionStatement(j.identifier('setupRenderingTest(hooks);\nsetupFactoryGuy(hooks)')),
        );
      })
      .toSource();
  }

  // rendering
  let renderCollection = j(code).find(j.ExpressionStatement, {
    expression: {
      type: 'CallExpression',
      callee: {
        property: {
          type: 'Identifier',
          name: 'render',
        },
      },
    },
  });

  if (hasIdentifierCalled(j, code, 'renderComponent')) {
    code = renderCollection
      .forEach(path => {
        j(path).replaceWith(
          j.returnStatement(
            j.callExpression(j.identifier('render'), path.value.expression.arguments),
          ),
        );
      })
      .toSource();

    code = findFunction(j, code, 'renderComponent')
      .forEach(path => {
        j(path).replaceWith(
          j.expressionStatement(
            j.awaitExpression(
              j.callExpression(j.identifier('renderComponent'), path.value.expression.arguments),
            ),
          ),
        );
        j(path)
          .closest(j.FunctionExpression)
          .forEach(path => {
            path.value.async = false;
          });
      })
      .toSource();

    code = j(code)
      .find(j.FunctionDeclaration, { id: { type: 'Identifier', name: 'renderComponent' } })
      .forEach(path => {
        path.value.async = false;
        j(path)
          .find(j.ReturnStatement, {
            argument: {
              type: 'AwaitExpression',
              argument: {
                type: 'CallExpression',
                callee: {
                  type: 'Identifier',
                  name: 'render',
                },
              },
            },
          })
          .forEach(path => {
            j(path).replaceWith(
              j.returnStatement(
                j.callExpression(j.identifier('render'), path.value.argument.argument.arguments),
              ),
            );
            path.value.async = false;
          });
      })
      .toSource();
  } else {
    code = renderCollection
      .forEach(path => {
        j(path)
          .closest(j.FunctionDeclaration)
          .forEach(path => {
            path.value.async = true;
          });
        j(path).replaceWith(
          j.expressionStatement(
            j.awaitExpression(
              j.callExpression(j.identifier('render'), path.value.expression.arguments),
            ),
          ),
        );
        j(path)
          .closest(j.FunctionExpression)
          .forEach(path => {
            path.value.async = true;
          });
      })
      .toSource();
  }

  // test helpers
  code = j(code)
    .find(j.Literal, { value: 'ember-test-helpers' })
    .forEach(path => {
      j(path).replaceWith(j.literal('@ember/test-helpers'));
    })
    .toSource();
  code = addImport(j, code, 'render', '@ember/test-helpers');
  j(code)
    .find(j.ImportDeclaration, { source: { value: 'ember-native-dom-helpers' } })
    .forEach(path => {
      path.value.specifiers.forEach(specifier => {
        code = addImport(j, code, specifier.local.name, '@ember/test-helpers');
      });
    })
    .toSource();
  code = removeImport(j, code, 'ember-native-dom-helpers');

  if (j(code).find(j.Literal, { value: 'ember-test-helpers/wait' }).length) {
    code = removeImport(j, code, 'ember-test-helpers/wait');
    code = addImport(j, code, 'settled', '@ember/test-helpers');

    code = j(code)
      .find(j.ExpressionStatement, {
        expression: {
          type: 'AwaitExpression',
          argument: {
            type: 'CallExpression',
            callee: {
              type: 'Identifier',
              name: 'wait',
            },
          },
        },
      })
      .forEach(path => {
        j(path).replaceWith(
          j.expressionStatement(j.awaitExpression(j.callExpression(j.identifier('wait'), []))),
        );
      })
      .toSource();
  }

  // notification service
  let notificationServiceFunctionCalls = getNotificationServiceFunctions(j, code);
  if (notificationServiceFunctionCalls.length) {
    code = addImport(
      j,
      code,
      'setupNotificationsService',
      'embercom/tests/helpers/services/notifications',
    );
    code = j(code)
      .find(j.ExpressionStatement, {
        expression: {
          type: 'CallExpression',
          callee: { type: 'Identifier', name: 'setupRenderingTest' },
        },
      })
      .forEach(path => {
        j(path).insertAfter(
          j.expressionStatement(j.callExpression(j.identifier('setupNotificationsService'), [])),
        );
      })
      .toSource();

    code = notificationServiceFunctionCalls
      .forEach(path => {
        path.value.expression.arguments.unshift(j.identifier('assert'));
        j(path).replaceWith(
          j.expressionStatement(
            j.callExpression(
              j.identifier(path.value.expression.callee.property.name),
              path.value.expression.arguments,
            ),
          ),
        );
      })
      .toSource();
  }

  return code;
};
