import {
  ServerUnaryCall,
  sendUnaryData,
  ServerWriteableStream,
  ServiceError,
  status,
  handleUnaryCall,
} from 'grpc';
import {
  Point,
  Feature,
  Rectangle,
} from '../../../__tests__/fixtures/static_codegen/route_guide_pb';
import runTest from '../../../__tests__/helpers/runTest';

describe('grpc-experimental-server', () => {
  describe('should not timeout', () => {
    runTest({
      implementations: {
        getFeature(call: ServerUnaryCall<Point>, callback: sendUnaryData<Feature>) {
          callback(null, new Feature());
          return new Promise(resolve => setTimeout(resolve, 30000));
        },
      },
      testcase(server, client) {
        it('getFeature', done => {
          // @ts-ignore
          client().getFeature(new Point(), done);
        });
      },
    });

    runTest({
      implementations: {
        listFeatures(call: ServerWriteableStream<Feature>) {
          call.end();
          return new Promise(resolve => setTimeout(resolve, 30000));
        },
      },
      testcase(server, client) {
        it('listFeatures', done => {
          server().use(async (ctx, next) => {
            await next();
            done();
          });
          // @ts-ignore
          client().listFeatures(new Rectangle());
        });
      },
    });
  });

  describe('on finished', () => {
    runTest({
      testcase(server, client) {
        it('successful response', done => {
          let finished = false;
          server().use(async (ctx, next) => {
            ctx.onFinished(() => {
              finished = true;
            });
            await next();
            // expect(ctx.response.value).toBeInstanceOf(Feature)
          });
          // @ts-ignore
          client().getFeature(new Point(), () => {
            expect(finished).toEqual(true);
            done();
          });
        });
      },
    });
    runTest({
      implementations: {
        getFeature(call: ServerUnaryCall<unknown>, callback: sendUnaryData<unknown>) {
          const error: ServiceError = new Error('unexpected');
          error.code = status.PERMISSION_DENIED;
          callback(error, new Feature());
        },
      },
      testcase(server, client) {
        it('error', done => {
          let finished = false;
          server().use(async (ctx, next) => {
            ctx.onFinished(error => {
              try {
                expect(error).toBeInstanceOf(Error);
              } catch (e) {
                done(e);
              }
              finished = true;
            });
            next().catch(() => undefined);
          });
          // @ts-ignore
          client().getFeature(new Point(), () => {
            expect(finished).toEqual(true);
            done();
          });
        });
      },
    });
  });

  describe('postprocess', () => {
    runTest({
      testcase(server, client) {
        it('should get Feature', done => {
          server().use(async (ctx, next) => {
            await next();
            expect(ctx.response).toBeInstanceOf(Feature);
            done();
          });

          // @ts-ignore
          client().getFeature(new Point(), () => {});
        });
      },
    });
  });

  describe('capture error', () => {
    const getFeature: handleUnaryCall<Point, Feature> = (call, callback) => {
      const error: ServiceError = new Error('unexpected');
      error.code = status.PERMISSION_DENIED;
      callback(error, new Feature());
    };

    runTest({
      implementations: { getFeature },
      testcase(server, client) {
        it('getFeature', done => {
          server().use(async (ctx, next) => {
            next().catch(e => {
              expect(e.code).toEqual(status.PERMISSION_DENIED);
              expect(e.message).toEqual('unexpected');
              done();
            });
          });

          // @ts-ignore
          client().getFeature(new Point(), () => {});
        });
      },
    });
  });
});
