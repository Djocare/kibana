/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { usageCountersServiceMock } from '@kbn/usage-collection-plugin/server/usage_counters/usage_counters_service.mock';
import { getAlertInstanceSummaryRoute } from './get_alert_instance_summary';
import { httpServiceMock } from '@kbn/core/server/mocks';
import { licenseStateMock } from '../../lib/license_state.mock';
import { mockHandlerArguments } from '../_mock_handler_arguments';
import { SavedObjectsErrorHelpers } from '@kbn/core/server';
import { rulesClientMock } from '../../rules_client.mock';
import { AlertSummary } from '../../types';
import { trackLegacyRouteUsage } from '../../lib/track_legacy_route_usage';
import { RULE_SAVED_OBJECT_TYPE } from '../../saved_objects';
import { docLinksServiceMock } from '@kbn/core/server/mocks';

const rulesClient = rulesClientMock.create();
jest.mock('../../lib/license_api_access', () => ({
  verifyApiAccess: jest.fn(),
}));

jest.mock('../../lib/track_legacy_route_usage', () => ({
  trackLegacyRouteUsage: jest.fn(),
}));

beforeEach(() => {
  jest.resetAllMocks();
});

describe('getAlertInstanceSummaryRoute', () => {
  const docLinks = docLinksServiceMock.createSetupContract();
  const dateString = new Date().toISOString();
  const mockedAlertInstanceSummary: AlertSummary = {
    id: '',
    name: '',
    tags: [],
    ruleTypeId: '',
    consumer: '',
    muteAll: false,
    throttle: null,
    enabled: false,
    statusStartDate: dateString,
    statusEndDate: dateString,
    status: 'OK',
    errorMessages: [],
    alerts: {},
    executionDuration: {
      average: 0,
      valuesWithTimestamp: {},
    },
    revision: 0,
  };

  it('gets alert instance summary', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();

    getAlertInstanceSummaryRoute(router, licenseState, docLinks);

    const [config, handler] = router.get.mock.calls[0];

    expect(config.path).toMatchInlineSnapshot(`"/api/alerts/alert/{id}/_instance_summary"`);
    expect(config.options?.access).toBe('public');

    rulesClient.getAlertSummary.mockResolvedValueOnce(mockedAlertInstanceSummary);

    const [context, req, res] = mockHandlerArguments(
      { rulesClient },
      {
        params: {
          id: '1',
        },
        query: {},
      },
      ['ok']
    );

    await handler(context, req, res);

    expect(rulesClient.getAlertSummary).toHaveBeenCalledTimes(1);
    expect(rulesClient.getAlertSummary.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        Object {
          "dateStart": undefined,
          "id": "1",
        },
      ]
    `);

    expect(res.ok).toHaveBeenCalled();
  });

  it('should have internal access for serverless', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();

    getAlertInstanceSummaryRoute(router, licenseState, docLinks, undefined, true);

    const [config] = router.get.mock.calls[0];

    expect(config.path).toMatchInlineSnapshot(`"/api/alerts/alert/{id}/_instance_summary"`);
    expect(config.options?.access).toBe('internal');
  });

  it('returns NOT-FOUND when alert is not found', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();

    getAlertInstanceSummaryRoute(router, licenseState, docLinks);

    const [, handler] = router.get.mock.calls[0];

    rulesClient.getAlertSummary = jest
      .fn()
      .mockResolvedValueOnce(
        SavedObjectsErrorHelpers.createGenericNotFoundError(RULE_SAVED_OBJECT_TYPE, '1')
      );

    const [context, req, res] = mockHandlerArguments(
      { rulesClient },
      {
        params: {
          id: '1',
        },
        query: {},
      },
      ['notFound']
    );

    expect(await handler(context, req, res)).toEqual(undefined);
  });

  it('should track every call', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();
    const mockUsageCountersSetup = usageCountersServiceMock.createSetupContract();
    const mockUsageCounter = mockUsageCountersSetup.createUsageCounter('test');

    getAlertInstanceSummaryRoute(router, licenseState, docLinks, mockUsageCounter);
    const [, handler] = router.get.mock.calls[0];

    rulesClient.getAlertSummary.mockResolvedValueOnce(mockedAlertInstanceSummary);
    const [context, req, res] = mockHandlerArguments(
      { rulesClient },
      { params: { id: '1' }, query: {} },
      ['ok']
    );
    await handler(context, req, res);
    expect(trackLegacyRouteUsage).toHaveBeenCalledWith('instanceSummary', mockUsageCounter);
  });

  it('should be deprecated', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();

    getAlertInstanceSummaryRoute(router, licenseState, docLinks);

    const [config] = router.get.mock.calls[0];

    expect(config.options?.deprecated).toMatchInlineSnapshot(
      {
        documentationUrl: expect.stringMatching(/#breaking-201550$/),
      },
      `
      Object {
        "documentationUrl": StringMatching /#breaking-201550\\$/,
        "reason": Object {
          "type": "remove",
        },
        "severity": "warning",
      }
    `
    );
  });
});
