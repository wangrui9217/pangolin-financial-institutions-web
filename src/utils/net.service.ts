import axios from 'axios';
import Qs from 'qs';
import app from '~/config/app.config';
import store from '~/store';
import { Observable } from 'rxjs';
import { StorageService } from '~/utils/storage.service';
import { SortService } from '~/utils/sort.service';
import { MessageBox, Loading, Notification } from 'element-ui';
import router from '~/router';

const getType = ['GET', 'DELETE']; // 使用GET请求类型
const errorMessage = {
  systemError: '系统异常，请稍后重试.',
  serverError: '服务端异常,请稍后重试.',
  netError: '服务端连接异常，请检查服务端状态.',
};
export class NetService {
  public static generateRequestUrl(
    {
      service,
      controller,
      action,
      url,
    }: { service: string; controller: string; action: string; url?: string },
    append = [],
    sort?,
  ): string {
    // 自定义url优先级最高
    if (url) return url;

    // 进行url拼接
    if (controller) {
      let targetUrl = [service, 'api', controller, action, ...append]
        .filter((x) => x)
        .join('/');

      // 开启排序
      if (sort) {
        targetUrl += `?${SortService.stringify(sort)}`;
      }

      return targetUrl;
    } else {
      throw new Error('server配置异常,请检查对应server配置');
    }
  }
  // 使用GET请求类型
  private axiosInstance;
  private userToken;
  private store;
  private loading: any = {};

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: app.url.server,
      timeout: app.timeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  /**
   * 发送网络请求信息
   * @param param0
   */
  public send(options: any): Observable<any> {
    let data = { ...options.data };
    let postData;
    let getData;

    const url = NetService.generateRequestUrl(
      options.server,
      options.append,
      options.sort,
    );
    const method = options.server.type || 'GET';
    const headers = this.generateRequestHeader(options.headers);

    // 分页检测
    if (options.page) {
      data = { ...data, ...options.page.getConfig() };
    }
    // 判断参数类型
    getType.indexOf(method) > -1
      ? (getData = this.filterEmptyData(data))
      : (postData = data);

    if (options.loading) {
      this.loading = Loading.service({
        fullscreen: true,
        lock: true,
        text: '勤劳的穿山甲正在处理中，请稍等...',
      });
    }

    // 创建待观察对象
    const observable = Observable.create((observer) => {
      this.axiosInstance
        .request({
          method,
          url,
          headers,
          data: postData,
          params: getData,
          paramsSerializer: (params) =>
            Qs.stringify(params, {
              arrayFormat: 'repeat',
              skipNulls: true,
              allowDots: true,
            }),
        })
        .then(({ data }) => {
          // 分页数据处理
          if (options.page && data.content) {
            options.page.update(data);
            data = data.content;
          }
          // 关闭等待
          if (options.loading) {
            setTimeout(() => {
              this.loading.close();
            }, 500);
          }
          observer.next(data);
        })
        .catch(this.catchHandle(options, observer));
    });

    return observable;
  }

  /**
   * 生成头部信息
   */
  private generateRequestHeader(headers): object {
    const token = StorageService.getItem('userToken') || '';
    if (token) {
      return {
        'X-UserToken': token,
        ...headers,
      };
    } else {
      return headers || {};
    }
  }

  /**
   * 过滤空数据
   * @param data
   */
  private filterEmptyData(data) {
    Object.entries(data)
      .filter(([key, value]) => {
        // 过滤空字符串
        if (value === undefined || value === '') {
          return true;
        }

        // 过滤空数组
        if (
          value instanceof Array &&
          (value.length === 0 || value.every((x) => x === ''))
        ) {
          return true;
        }
      })
      .forEach(([key, value]) => {
        delete data[key];
      });
    return data;
  }

  /**
   * 异常处理
   */
  private catchHandle(options, observer) {
    return (ex) => {
      // 错误信息
      console.log('ex==>', ex);
      const error: any = {
        msg: '',
        params: '',
        data: ex.response.data,
      };

      if (options.loading) {
        setTimeout(() => {
          this.loading.close();
        }, 500);
      }

      // 逻辑异常检测
      if (!ex.response && !ex.request) {
        error.msg = ex.message;
        error.params = ex.stack;
        console.error(ex.stack);
        Notification.error(errorMessage.systemError)
        return Observable.empty();
      }

      // 网络异常检测
      if (!ex.response && ex.request) {
        error.msg = errorMessage.netError;
      }

      if (ex.response) {
        error.msg = errorMessage.netError;
        // 错误类型检测
        switch (ex.response.status) {
          case 400: {
            const data: any = ex.response.data || {};
            error.msg = '';
            data.errors.forEach((x) => {
              if (x.defaultMessage) {
                Notification.error(x.defaultMessage)
              }
            });
            error.params = data.errors.join(';');
            break;
          }
          case 403: {
            if (!store.state.tokenExpire) {
              store.commit('updateTokenExpire', true);
            } else {
              break;
            }

            if (!options.skipAuth) {
              console.log(options);
              MessageBox.alert('用户登录过期,请重新登录', '提示', {
                confirmButtonText: '确定',
                callback: () => {
                  router.push('/');
                },
              });
              return;
            }
          }
          case 500: {
            Notification.error(errorMessage.serverError)
            break;
          }
        }
      }

      observer.error(error);
    };
  }
}
