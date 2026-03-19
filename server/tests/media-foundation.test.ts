import assert from "node:assert/strict";
import test from "node:test";
import { createMediaFoundation } from "../src/media/foundation.js";

test("should create mediasoup worker/router and expose basic WebRTC transport flow", async () => {
  /*
   * Проверяем основной foundation-сценарий: сервер должен поднять worker и router,
   * создать WebRTC transport и вернуть сериализуемые transport-параметры, которые
   * позже потребуются signaling-слою. Это важно как базовый контракт media foundation.
   */
  const workerCreateCalls: Array<Record<string, unknown>> = [];
  const routerCreateCalls: Array<{ mediaCodecs: unknown[] }> = [];
  const transportCreateCalls: Array<Record<string, unknown>> = [];
  const incomingBitrateCalls: number[] = [];
  let routerClosed = false;
  let workerClosed = false;

  const transport = {
    id: "transport-1",
    iceParameters: { usernameFragment: "ufrag" },
    iceCandidates: [{ foundation: "foundation" }],
    dtlsParameters: { fingerprints: [] },
    sctpParameters: undefined,
    async connect() {},
    async setMaxIncomingBitrate(bitrate: number) {
      incomingBitrateCalls.push(bitrate);
    },
    close() {},
  };

  const foundation = await createMediaFoundation({
    mediasoupApi: {
      async createWorker(options) {
        workerCreateCalls.push(options);

        return {
          async createRouter(options) {
            routerCreateCalls.push(options);

            return {
              rtpCapabilities: {
                codecs: ["opus", "vp8"],
              },
              async createWebRtcTransport(options) {
                transportCreateCalls.push(options);
                return transport;
              },
              close() {
                routerClosed = true;
              },
            };
          },
          close() {
            workerClosed = true;
          },
        };
      },
    },
  });

  const createdTransport = await foundation.createWebRtcTransport();

  assert.equal(workerCreateCalls.length, 1);
  assert.equal(routerCreateCalls.length, 1);
  assert.equal(transportCreateCalls.length, 1);
  assert.ok(Array.isArray(routerCreateCalls[0]?.mediaCodecs));
  assert.deepEqual(foundation.getRouterRtpCapabilities(), { codecs: ["opus", "vp8"] });
  assert.equal(createdTransport.transport.id, "transport-1");
  assert.equal(createdTransport.params.id, "transport-1");
  assert.deepEqual(createdTransport.params.iceParameters, { usernameFragment: "ufrag" });
  assert.equal(createdTransport.params.sctpParameters, null);
  assert.equal(incomingBitrateCalls.length, 1);

  await foundation.close();

  assert.equal(routerClosed, true);
  assert.equal(workerClosed, true);
});

test("should connect a created transport through the foundation helper", async () => {
  /*
   * Проверяем базовый transport connect flow: foundation должен уметь вызвать
   * transport.connect с переданными DTLS-параметрами. Это важно для следующего
   * signaling-шага, где connect transport пойдет уже через LiveRail bridge.
   */
  const connectCalls: unknown[] = [];

  const foundation = await createMediaFoundation({
    mediasoupApi: {
      async createWorker() {
        return {
          async createRouter() {
            return {
              rtpCapabilities: {},
              async createWebRtcTransport() {
                return {
                  id: "transport-2",
                  iceParameters: {},
                  iceCandidates: [],
                  dtlsParameters: {},
                  async connect(options: { dtlsParameters: unknown }) {
                    connectCalls.push(options.dtlsParameters);
                  },
                  close() {},
                };
              },
              close() {},
            };
          },
          close() {},
        };
      },
    },
  });

  const createdTransport = await foundation.createWebRtcTransport();
  const dtlsParameters = { fingerprints: [{ algorithm: "sha-256" }] };

  await foundation.connectWebRtcTransport(createdTransport.transport, dtlsParameters);

  assert.deepEqual(connectCalls, [dtlsParameters]);
});
