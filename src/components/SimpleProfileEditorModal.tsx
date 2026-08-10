import { useState, useEffect } from 'react';
import { Key, Shield, Network, Eye, Gauge, Check, X, ChevronDown, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore, Profile } from '../store/useAppStore';
import './SimpleProfileEditorModal.css';

interface Props {
  profile: Profile;
  onClose: () => void;
}

const encode = (s: string) => encodeURIComponent(s);

const parseQuery = (queryStr: string | null): Record<string, string> => {
  if (!queryStr) return {};
  const res: Record<string, string> = {};
  queryStr.split('&').forEach(part => {
    const [k, v] = part.split('=', 2);
    if (k) {
      try {
        res[decodeURIComponent(k)] = v ? decodeURIComponent(v) : '';
      } catch {
        res[k] = v || '';
      }
    }
  });
  return res;
};

export default function SimpleProfileEditorModal({ profile, onClose }: Props) {
  const { t } = useTranslation();
  const updateProfileDetails = useAppStore(state => state.updateProfileDetails);
  const addNotification = useAppStore(state => state.addNotification);

  const [scheme, setScheme] = useState('vless');
  const [tag, setTag] = useState(profile.name);
  const [server, setServer] = useState('');
  const [port, setPort] = useState('');
  const [uuid, setUuid] = useState('');
  const [password, setPassword] = useState('');
  const [alterId, setAlterId] = useState('0');
  const [vmessSecurity, setVmessSecurity] = useState('auto');
  const [flow, setFlow] = useState('');
  const [packetEncoding, setPacketEncoding] = useState('');
  const [method, setMethod] = useState('');
  const [isTls, setIsTls] = useState(false);
  const [sni, setSni] = useState('');
  const [alpn, setAlpn] = useState('');
  const [fingerprint, setFingerprint] = useState('chrome');
  const [mport, setMport] = useState('');
  const [pbk, setPbk] = useState('');
  const [sid, setSid] = useState('');
  const [upMbps, setUpMbps] = useState('');
  const [downMbps, setDownMbps] = useState('');
  const [insecure, setInsecure] = useState(false);
  const [pin, setPin] = useState('');
  const [obfsType, setObfsType] = useState('');
  const [obfsPassword, setObfsPassword] = useState('');
  const [hopInterval, setHopInterval] = useState('');


  const [transport, setTransport] = useState('tcp');
  const [tcpHost, setTcpHost] = useState('');
  const [tcpPath, setTcpPath] = useState('');
  const [kcpSeed, setKcpSeed] = useState('');
  const [kcpMtu, setKcpMtu] = useState('1350');
  const [kcpTti, setKcpTti] = useState('50');
  const [wsHost, setWsHost] = useState('');
  const [wsPath, setWsPath] = useState('/');
  const [httpUpgradeHost, setHttpUpgradeHost] = useState('');
  const [httpUpgradePath, setHttpUpgradePath] = useState('/');
  const [h2Host, setH2Host] = useState('');
  const [h2Path, setH2Path] = useState('/');
  const [quicSecurity, setQuicSecurity] = useState('none');
  const [quicKey, setQuicKey] = useState('');
  const [grpcAuthority, setGrpcAuthority] = useState('');
  const [grpcServiceName, setGrpcServiceName] = useState('');
  const [xhttpHost, setXhttpHost] = useState('');
  const [xhttpPath, setXhttpPath] = useState('/');
  const [xhttpMode, setXhttpMode] = useState('auto');

  const [tlsType, setTlsType] = useState('TLS');
  const [ssNetwork, setSsNetwork] = useState('tcp');
  const [ssWsPath, setSsWsPath] = useState('/');
  const [ssWsHost, setSsWsHost] = useState('');
  const [shadowTlsPassword, setShadowTlsPassword] = useState('');
  const [shadowTlsVersion, setShadowTlsVersion] = useState('3');


  const [peerPublicKey, setPeerPublicKey] = useState('');
  const [localAddress, setLocalAddress] = useState('10.7.0.2/32');
  const [presharedKey, setPresharedKey] = useState('');
  const [mtu, setMtu] = useState('');


  const [congestionControl, setCongestionControl] = useState('bbr');
  const [udpRelayMode, setUdpRelayMode] = useState('native');


  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const isRealitySupported = scheme === 'vless' || scheme === 'trojan';
  const showReality = isTls && isRealitySupported && tlsType === 'Reality';
  const isHysteria = scheme === 'hysteria' || scheme === 'hy' || scheme === 'hysteria2' || scheme === 'hy2';
  const isHysteria2 = scheme === 'hysteria2' || scheme === 'hy2';
  const isShadowsocks = scheme === 'ss' || scheme === 'shadowsocks';
  const isWireGuard = scheme === 'wireguard' || scheme === 'wg';
  const isTuic = scheme === 'tuic';
  const isTransportSupported = scheme === 'vless' || scheme === 'vmess' || scheme === 'trojan';

  useEffect(() => {
    if (!profile.uri) return;
    try {
      const uriStr = profile.uri.trim();
      let schemeVal = 'vless';
      let rawQuery: string | null = null;
      let hostVal = '';
      let portVal = '';
      let userInfoVal = '';
      let hashVal = profile.name;

      if (uriStr.includes('#')) {
        const parts = uriStr.split('#');
        try {
          hashVal = decodeURIComponent(parts[1]);
        } catch {
          hashVal = parts[1];
        }
      }

      const mainPart = uriStr.split('#')[0];
      const match = mainPart.match(/^([a-zA-Z0-9]+):\/\/(.*)$/);
      if (match) {
        schemeVal = match[1].toLowerCase();
        let body = match[2];
        if (body.includes('?')) {
          const qParts = body.split('?');
          body = qParts[0];
          rawQuery = qParts[1];
        }

        if (schemeVal === 'vmess' && !body.includes('@') && !body.includes(':')) {
          try {
            const decodedJson = atob(body.trim());
            const json = JSON.parse(decodedJson);
            setTag(hashVal || json.ps || profile.name);
            setServer(json.add || '');
            setPort(json.port ? String(json.port) : '443');
            setUuid(json.id || '');
            setAlterId(json.aid !== undefined ? String(json.aid) : '0');
            setVmessSecurity(json.scy || 'auto');
            setSni(json.sni || json.host || '');
            setAlpn(json.alpn || '');
            setIsTls(json.tls === 'tls');
            setTransport(json.net || 'tcp');
            setWsHost(json.host || '');
            setWsPath(json.path || '/');
            setScheme('vmess');
            return;
          } catch (e) {
            console.error('Failed to parse vmess json:', e);
          }
        }

        if (body.includes('@')) {
          const userHost = body.split('@');
          userInfoVal = userHost[0];
          const hp = userHost[1];
          if (hp.includes(':')) {
            hostVal = hp.split(':')[0];
            portVal = hp.split(':')[1];
          } else {
            hostVal = hp;
          }
        } else if (body.includes(':')) {
          hostVal = body.split(':')[0];
          portVal = body.split(':')[1];
        } else {
          hostVal = body;
        }
      }

      setScheme(schemeVal);
      setTag(hashVal || profile.name);
      setServer(hostVal);
      setPort(portVal);

      const queryParams = parseQuery(rawQuery);

      if (schemeVal === 'vless' || schemeVal === 'trojan' || schemeVal === 'vmess') {
        setUuid(userInfoVal);
        let fl = queryParams['flow'] || '';
        let pe = queryParams['packetEncoding'] || queryParams['packet_encoding'] || '';
        if (fl === 'xtls-rprx-vision-udp443') {
          fl = 'xtls-rprx-vision';
          pe = 'xudp';
        }
        setFlow(fl);
        setPacketEncoding(pe);

        const sec = queryParams['security'] || (schemeVal === 'trojan' ? 'tls' : 'none');
        const hasTls = sec === 'tls' || sec === 'reality';
        setIsTls(hasTls);
        setTlsType(sec === 'reality' ? 'Reality' : 'TLS');
        setSni(queryParams['sni'] || hostVal);
        setAlpn(queryParams['alpn'] || '');
        setFingerprint(queryParams['fp'] || 'chrome');

        if (sec === 'reality' || queryParams['pbk']) {
          setPbk(queryParams['pbk'] || '');
          setSid(queryParams['sid'] || '');
        } else {
          setPbk('');
          setSid('');
        }

        const isInc = queryParams['allowinsecure'] === '1' || queryParams['allowinsecure'] === 'true' ||
          queryParams['allowInsecure'] === '1' || queryParams['allowInsecure'] === 'true' ||
          queryParams['insecure'] === '1' || queryParams['insecure'] === 'true';
        setInsecure(isInc);

        const tr = queryParams['type'] || 'tcp';
        setTransport(tr);

        const h = queryParams['host'] || '';
        const p = queryParams['path'] || '/';
        setTcpHost(h);
        setTcpPath(queryParams['path'] || '');
        setKcpSeed(queryParams['seed'] || queryParams['kcpSeed'] || '');
        setKcpMtu(queryParams['mtu'] || '1350');
        setKcpTti(queryParams['tti'] || '50');
        setWsHost(h);
        setWsPath(p);
        setHttpUpgradeHost(h);
        setHttpUpgradePath(p);
        setH2Host(h);
        setH2Path(p);

        let qSec = queryParams['quicSecurity'] || queryParams['security'] || 'none';
        if (qSec === 'tls' || qSec === 'reality') qSec = 'none';
        setQuicSecurity(qSec);
        setQuicKey(queryParams['key'] || queryParams['quicKey'] || '');

        setGrpcAuthority(queryParams['authority'] || queryParams['grpcAuthority'] || '');
        setGrpcServiceName(queryParams['serviceName'] || queryParams['grpcServiceName'] || '');

        setXhttpHost(h);
        setXhttpPath(p);
        setXhttpMode(queryParams['mode'] || 'auto');
      } else if (schemeVal === 'ss' || schemeVal === 'shadowsocks') {
        let decodedUserInfo = userInfoVal;
        try {
          decodedUserInfo = atob(userInfoVal);
        } catch {
          decodedUserInfo = userInfoVal;
        }
        if (decodedUserInfo.includes(':')) {
          setMethod(decodedUserInfo.split(':')[0]);
          setUuid(decodedUserInfo.split(':').slice(1).join(':'));
        } else {
          setMethod(decodedUserInfo);
          setUuid('');
        }

        const pluginVal = queryParams['plugin'] || '';
        const pluginOpts = queryParams['plugin-opts'] || queryParams['plugin_opts'] || '';
        const combinedOpts = pluginVal.includes(';') ? pluginVal.split(';').slice(1).join(';') : pluginOpts;

        const optsMap: Record<string, string> = {};
        combinedOpts.split(';').forEach(opt => {
          const parts = opt.split('=', 2);
          if (parts.length === 2) {
            optsMap[parts[0].trim().toLowerCase()] = parts[1].trim();
          } else if (opt.trim()) {
            optsMap[opt.trim().toLowerCase()] = 'true';
          }
        });

        const isWs = combinedOpts.includes('websocket') || combinedOpts.includes('mode=websocket') || optsMap['mode'] === 'websocket' || queryParams['type'] === 'ws';
        setSsNetwork(isWs ? 'ws' : 'tcp');
        setSsWsPath(optsMap['path'] || queryParams['path'] || '/');
        setSsWsHost(optsMap['host'] || queryParams['host'] || '');

        const hasTls = combinedOpts.includes('tls') || 'tls' in optsMap || queryParams['security'] === 'tls';
        const isShadowTls = pluginVal.startsWith('shadowtls') || (queryParams['plugin'] && queryParams['plugin'].startsWith('shadowtls'));
        setIsTls(hasTls || Boolean(isShadowTls));
        setSni(optsMap['host'] || optsMap['sni'] || queryParams['sni'] || queryParams['host'] || hostVal);

        if (isShadowTls) {
          setShadowTlsPassword(optsMap['password'] || queryParams['shadowtls-password'] || '');
          setShadowTlsVersion(optsMap['version'] || queryParams['shadowtls-version'] || '3');
        } else {
          setShadowTlsPassword('');
          setShadowTlsVersion('3');
        }
      } else if (schemeVal === 'hysteria' || schemeVal === 'hy' || schemeVal === 'hysteria2' || schemeVal === 'hy2') {
        setUuid(userInfoVal);
        setIsTls(true);
        setSni(queryParams['sni'] || queryParams['peer'] || hostVal);
        setAlpn(queryParams['alpn'] || '');
        setUpMbps(queryParams['upmbps'] || queryParams['up-mbps'] || queryParams['up'] || '');
        setDownMbps(queryParams['downmbps'] || queryParams['down-mbps'] || queryParams['down'] || '');

        const isInc = queryParams['insecure'] === '1' || queryParams['insecure'] === 'true' ||
          queryParams['allowInsecure'] === 'true' || queryParams['skip-cert-verify'] === 'true';
        setInsecure(isInc);
        setPin(queryParams['pin'] || '');

        if (schemeVal === 'hysteria2' || schemeVal === 'hy2') {
          setObfsType(queryParams['obfs'] || queryParams['obfs-type'] || '');
          setObfsPassword(queryParams['obfs-password'] || queryParams['obfspassword'] || '');
          setMport(queryParams['mport'] || '');
          setHopInterval(queryParams['hop_interval'] || queryParams['hop-interval'] || queryParams['hopInterval'] || '');
        } else {
          setObfsType(queryParams['obfs'] || '');
          setObfsPassword('');
          setMport(queryParams['mport'] || '');
          setHopInterval('');
        }
        setFingerprint(queryParams['fp'] || queryParams['fingerprint'] || 'chrome');
      } else if (schemeVal === 'wireguard' || schemeVal === 'wg') {
        let decUser = userInfoVal;
        try {
          decUser = decodeURIComponent(userInfoVal);
        } catch {
          decUser = userInfoVal;
        }
        setUuid(decUser || queryParams['privatekey'] || queryParams['private_key'] || '');
        setPeerPublicKey(queryParams['publickey'] || queryParams['public-key'] || queryParams['peer_public_key'] || queryParams['peer-public-key'] || '');
        setLocalAddress(queryParams['address'] || queryParams['local_address'] || queryParams['local-address'] || '10.7.0.2/32');
        setPresharedKey(queryParams['presharedkey'] || queryParams['pre_shared_key'] || '');
        setMtu(queryParams['mtu'] || '');
      } else if (schemeVal === 'tuic') {
        if (userInfoVal.includes(':')) {
          setUuid(userInfoVal.split(':')[0]);
          setPassword(userInfoVal.split(':')[1]);
        } else {
          setUuid(userInfoVal);
          setPassword(queryParams['password'] || '');
        }
        setIsTls(true);
        setSni(queryParams['sni'] || hostVal);
        setAlpn(queryParams['alpn'] || 'h3');
        setCongestionControl(queryParams['congestion_control'] || queryParams['congestion-control'] || 'bbr');
        setUdpRelayMode(queryParams['udp_relay_mode'] || queryParams['udp-relay-mode'] || 'native');
        setInsecure(queryParams['insecure'] === '1' || queryParams['insecure'] === 'true' || queryParams['allowInsecure'] === 'true');
      } else {
        setUuid(userInfoVal);
      }
    } catch (e) {
      console.error('Failed to parse profile URI:', e);
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      const newName = tag.trim();
      const host = server.trim();
      const portText = port.trim();
      const cred = uuid.trim();

      let newUri = profile.uri || '';

      if (scheme === 'vless' || scheme === 'trojan') {
        const portStr = portText ? `:${portText}` : '';
        const query: string[] = [];

        query.push(`type=${transport}`);
        if (transport === 'tcp' || transport === 'raw') {
          if (tcpHost) query.push(`host=${encode(tcpHost)}`);
          if (tcpPath) query.push(`path=${encode(tcpPath)}`);
        } else if (transport === 'kcp') {
          if (tcpHost) query.push(`host=${encode(tcpHost)}`);
          if (tcpPath) query.push(`path=${encode(tcpPath)}`);
          if (kcpSeed) query.push(`seed=${encode(kcpSeed)}`);
          if (kcpMtu) query.push(`mtu=${encode(kcpMtu)}`);
          if (kcpTti) query.push(`tti=${encode(kcpTti)}`);
        } else if (transport === 'ws') {
          if (wsHost) query.push(`host=${encode(wsHost)}`);
          if (wsPath) query.push(`path=${encode(wsPath)}`);
        } else if (transport === 'httpupgrade') {
          if (httpUpgradeHost) query.push(`host=${encode(httpUpgradeHost)}`);
          if (httpUpgradePath) query.push(`path=${encode(httpUpgradePath)}`);
        } else if (transport === 'h2' || transport === 'http') {
          if (h2Host) query.push(`host=${encode(h2Host)}`);
          if (h2Path) query.push(`path=${encode(h2Path)}`);
        } else if (transport === 'quic') {
          query.push(`quicSecurity=${encode(quicSecurity)}`);
          if (quicKey) query.push(`key=${encode(quicKey)}`);
        } else if (transport === 'grpc') {
          if (grpcAuthority) query.push(`authority=${encode(grpcAuthority)}`);
          if (grpcServiceName) query.push(`serviceName=${encode(grpcServiceName)}`);
        } else if (transport === 'xhttp') {
          if (xhttpHost) query.push(`host=${encode(xhttpHost)}`);
          if (xhttpPath) query.push(`path=${encode(xhttpPath)}`);
          if (xhttpMode) query.push(`mode=${encode(xhttpMode)}`);
        }

        if (scheme === 'vless' && flow) {
          query.push(`flow=${encode(flow)}`);
        }
        if (scheme === 'vless' && packetEncoding) {
          query.push(`packetEncoding=${encode(packetEncoding)}`);
        }

        if (isTls) {
          if (tlsType === 'Reality') {
            query.push('security=reality');
            if (pbk.trim()) query.push(`pbk=${encode(pbk.trim())}`);
            if (sid.trim()) query.push(`sid=${encode(sid.trim())}`);
          } else {
            query.push('security=tls');
            query.push(insecure ? 'allowinsecure=1' : 'allowinsecure=0');
          }
          if (sni.trim()) query.push(`sni=${encode(sni.trim())}`);
          if (alpn.trim()) query.push(`alpn=${encode(alpn.trim())}`);
          if (fingerprint.trim()) query.push(`fp=${encode(fingerprint.trim())}`);
        } else {
          query.push('security=none');
        }

        newUri = `${scheme}://${cred}@${host}${portStr}?${query.join('&')}#${encode(newName)}`;
      } else if (scheme === 'vmess') {
        let isJsonUri = false;
        let jsonObj: any = {};
        try {
          const b64 = (profile.uri || '').replace('vmess://', '').trim();
          jsonObj = JSON.parse(atob(b64));
          isJsonUri = true;
        } catch {
          isJsonUri = false;
        }

        if (isJsonUri) {
          jsonObj.ps = newName;
          jsonObj.add = host;
          jsonObj.port = parseInt(portText, 10) || 443;
          jsonObj.id = cred;
          jsonObj.aid = parseInt(alterId, 10) || 0;
          jsonObj.scy = vmessSecurity;
          jsonObj.net = transport;
          jsonObj.host = wsHost;
          jsonObj.path = wsPath;
          if (isTls) {
            jsonObj.tls = 'tls';
            jsonObj.sni = sni.trim();
            jsonObj.alpn = alpn.trim();
          } else {
            jsonObj.tls = '';
          }
          const newB64 = btoa(JSON.stringify(jsonObj));
          newUri = `vmess://${newB64}`;
        } else {
          const portStr = portText ? `:${portText}` : ':443';
          const query: string[] = [];
          query.push(`type=${transport}`);
          if (wsHost) query.push(`host=${encode(wsHost)}`);
          if (wsPath) query.push(`path=${encode(wsPath)}`);
          if (isTls) {
            query.push('security=tls');
            if (sni.trim()) query.push(`sni=${encode(sni.trim())}`);
            if (alpn.trim()) query.push(`alpn=${encode(alpn.trim())}`);
          }
          newUri = `vmess://${cred}@${host}${portStr}?${query.join('&')}#${encode(newName)}`;
        }
      } else if (scheme === 'ss' || scheme === 'shadowsocks') {
        const portStr = portText ? `:${portText}` : '';
        const auth = btoa(`${method}:${cred}`);
        const query: string[] = [];

        if (isTls) {
          if (ssNetwork === 'ws') {
            const opts = ['mode=websocket'];
            if (ssWsPath) opts.push(`path=${ssWsPath.trim()}`);
            if (ssWsHost) opts.push(`host=${ssWsHost.trim()}`);
            opts.push('tls');
            if (sni.trim()) opts.push(`sni=${sni.trim()}`);
            query.push(`plugin=v2ray-plugin%3B${encode(opts.join(';'))}`);
            query.push('security=tls');
            if (sni.trim()) query.push(`sni=${encode(sni.trim())}`);
            if (ssWsPath) query.push(`path=${encode(ssWsPath.trim())}`);
            if (ssWsHost) query.push(`host=${encode(ssWsHost.trim())}`);
            query.push('type=ws');
          } else {
            const opts: string[] = [];
            if (shadowTlsPassword) opts.push(`password=${shadowTlsPassword.trim()}`);
            if (shadowTlsVersion) opts.push(`version=${shadowTlsVersion.trim()}`);
            if (sni.trim()) opts.push(`host=${sni.trim()}`);
            query.push(`plugin=shadowtls%3B${encode(opts.join(';'))}`);
            query.push('security=tls');
            if (sni.trim()) query.push(`sni=${encode(sni.trim())}`);
            if (shadowTlsPassword) query.push(`shadowtls-password=${encode(shadowTlsPassword.trim())}`);
            if (shadowTlsVersion) query.push(`shadowtls-version=${encode(shadowTlsVersion.trim())}`);
            query.push('type=tcp');
          }
        } else {
          if (ssNetwork === 'ws') {
            const opts = ['mode=websocket'];
            if (ssWsPath) opts.push(`path=${ssWsPath.trim()}`);
            if (ssWsHost) opts.push(`host=${ssWsHost.trim()}`);
            query.push(`plugin=v2ray-plugin%3B${encode(opts.join(';'))}`);
            if (ssWsPath) query.push(`path=${encode(ssWsPath.trim())}`);
            if (ssWsHost) query.push(`host=${encode(ssWsHost.trim())}`);
            query.push('type=ws');
          }
        }
        const params = query.length ? '?' + query.join('&') : '';
        newUri = `ss://${auth}@${host}${portStr}${params}#${encode(newName)}`;
      } else if (isHysteria) {
        const portStr = portText ? `:${portText}` : '';
        const query: string[] = [];
        if (sni.trim()) query.push(`sni=${encode(sni.trim())}`);
        if (alpn.trim()) query.push(`alpn=${encode(alpn.trim())}`);
        if (insecure) query.push('insecure=true');
        if (pin.trim()) query.push(`pin=${encode(pin.trim())}`);
        if (upMbps.trim()) query.push(`up=${encode(upMbps.trim())}`);
        if (downMbps.trim()) query.push(`down=${encode(downMbps.trim())}`);

        if (isHysteria2) {
          if (obfsType.trim()) {
            query.push(`obfs=${encode(obfsType.trim())}`);
            if (obfsPassword.trim()) query.push(`obfs-password=${encode(obfsPassword.trim())}`);
          }
          if (hopInterval.trim()) query.push(`hop_interval=${encode(hopInterval.trim())}`);
        } else {
          if (obfsType.trim()) query.push(`obfs=${encode(obfsType.trim())}`);
        }
        if (mport.trim()) query.push(`mport=${encode(mport.trim())}`);

        const params = query.length ? '?' + query.join('&') : '';
        newUri = `${scheme}://${cred}@${host}${portStr}${params}#${encode(newName)}`;
      } else if (isWireGuard) {
        const portStr = portText ? `:${portText}` : ':51820';
        const query: string[] = [];
        if (peerPublicKey.trim()) query.push(`publickey=${encode(peerPublicKey.trim())}`);
        if (localAddress.trim()) query.push(`address=${encode(localAddress.trim())}`);
        if (presharedKey.trim()) query.push(`presharedkey=${encode(presharedKey.trim())}`);
        if (mtu.trim()) query.push(`mtu=${encode(mtu.trim())}`);
        const params = query.length ? '?' + query.join('&') : '';
        newUri = `${scheme}://${encode(cred)}@${host}${portStr}${params}#${encode(newName)}`;
      } else if (isTuic) {
        const portStr = portText ? `:${portText}` : ':8443';
        const query: string[] = [];
        if (password.trim()) query.push(`password=${encode(password.trim())}`);
        if (sni.trim()) query.push(`sni=${encode(sni.trim())}`);
        if (alpn.trim()) query.push(`alpn=${encode(alpn.trim())}`);
        if (congestionControl.trim()) query.push(`congestion_control=${encode(congestionControl.trim())}`);
        if (udpRelayMode.trim()) query.push(`udp_relay_mode=${encode(udpRelayMode.trim())}`);
        if (insecure) query.push('insecure=true');
        const params = query.length ? '?' + query.join('&') : '';
        newUri = `tuic://${cred}@${host}${portStr}${params}#${encode(newName)}`;
      }

      const parseResult: any = await invoke('parse_clipboard', { text: newUri });
      const parsedProfile = parseResult.profiles && parseResult.profiles[0];

      updateProfileDetails(profile.id, {
        uri: newUri,
        name: newName,
        config_json: parsedProfile?.config_json || profile.config_json,
        protocol: parsedProfile?.protocol || profile.protocol,
        serverDescription: parsedProfile?.server_description || profile.serverDescription
      });

      addNotification('success', t('subscriptionCard.profileUpdated'), 3);
      onClose();
    } catch (e) {
      console.error('Failed to save profile:', e);
    }
  };

  const getUuidLabel = () => {
    switch (scheme) {
      case 'wireguard':
      case 'wg':
        return t('simpleEditor.privateKey');
      case 'vless':
      case 'vmess':
      case 'tuic':
        return t('simpleEditor.uuid');
      case 'trojan':
      case 'ss':
      case 'shadowsocks':
      case 'hysteria':
      case 'hy':
      case 'hysteria2':
      case 'hy2':
        return t('simpleEditor.password');
      default:
        return t('simpleEditor.credentials');
    }
  };

  const renderSelect = (
    key: string,
    label: string,
    value: string,
    options: { value: string; label: string }[],
    onSelect: (val: string) => void
  ) => {
    const isOpen = openDropdown === key;
    const currentLabel = options.find(o => o.value === value)?.label || value || t('simpleEditor.none');

    return (
      <div className={`simple-editor-select-field ${isOpen ? 'open' : ''}`} onClick={() => setOpenDropdown(isOpen ? null : key)}>
        <span className="simple-editor-field-label">{label}</span>
        <div className="simple-editor-select-row">
          <span className="simple-editor-select-value">{currentLabel}</span>
          <ChevronDown size={16} className="simple-editor-select-icon" />
        </div>

        {isOpen && (
          <div className="simple-editor-dropdown" onClick={e => e.stopPropagation()}>
            {options.map(opt => (
              <div
                key={opt.value}
                className={`simple-editor-dropdown-item ${opt.value === value ? 'selected' : ''}`}
                onClick={() => {
                  onSelect(opt.value);
                  setOpenDropdown(null);
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTextField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder = ''
  ) => (
    <div className="simple-editor-text-field">
      <span className="simple-editor-field-label">{label}</span>
      <input
        type="text"
        className="simple-editor-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  const renderSwitchField = (
    label: string,
    checked: boolean,
    onChange: (c: boolean) => void
  ) => (
    <div className="simple-editor-switch-field" onClick={() => onChange(!checked)}>
      <span className="simple-editor-switch-label">{label}</span>
      <div className={`simple-editor-switch ${checked ? 'checked' : ''}`}>
        <div className="simple-editor-switch-handle" />
      </div>
    </div>
  );

  return (
    <div className="simple-editor-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="simple-editor-container">

        <div className="simple-editor-header">
          <div className="simple-editor-header-left">
            <h2 className="simple-editor-title">{t('simpleEditor.title')}</h2>
            <span className="simple-editor-protocol-badge">{scheme}</span>
          </div>
          <div className="simple-editor-header-actions">
            <button className="simple-editor-icon-btn simple-editor-save-btn" title="Save" onClick={handleSave}>
              <Check size={20} />
            </button>
            <button className="simple-editor-icon-btn" title="Close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>


        <div className="simple-editor-body">

          <div className="simple-editor-section">
            <div className="simple-editor-section-title">
              <Key size={14} />
              <span>{t('simpleEditor.basic')}</span>
            </div>
            <div className="simple-editor-group">
              {renderTextField(t('simpleEditor.tag'), tag, setTag)}
              <div className="simple-editor-field-divider" />
              {renderTextField(t('simpleEditor.server'), server, setServer)}
              <div className="simple-editor-field-divider" />
              {renderTextField(t('simpleEditor.port'), port, setPort)}
              <div className="simple-editor-field-divider" />
              {renderTextField(getUuidLabel(), uuid, setUuid)}

              {isTuic && (
                <>
                  <div className="simple-editor-field-divider" />
                  {renderTextField(t('simpleEditor.password'), password, setPassword)}
                </>
              )}

              {scheme === 'vless' && (
                <>
                  <div className="simple-editor-field-divider" />
                  {renderSelect(
                    'flow',
                    t('simpleEditor.flow'),
                    flow === '' ? 'None' : flow,
                    [
                      { value: 'xtls-rprx-vision', label: 'xtls-rprx-vision' },
                      { value: 'None', label: 'None' }
                    ],
                    v => setFlow(v === 'None' ? '' : v)
                  )}
                  <div className="simple-editor-field-divider" />
                  {renderSelect(
                    'packetEncoding',
                    t('simpleEditor.packetEncoding'),
                    packetEncoding === '' ? 'None' : packetEncoding,
                    [
                      { value: 'None', label: 'None' },
                      { value: 'packet', label: 'packet' },
                      { value: 'xudp', label: 'xudp' }
                    ],
                    v => setPacketEncoding(v === 'None' ? '' : v)
                  )}
                </>
              )}

              {scheme === 'vmess' && (
                <>
                  <div className="simple-editor-field-divider" />
                  {renderTextField('AlterID', alterId, setAlterId, '0')}
                  <div className="simple-editor-field-divider" />
                  {renderSelect(
                    'vmessSecurity',
                    'Security',
                    vmessSecurity,
                    [
                      { value: 'auto', label: 'auto' },
                      { value: 'aes-128-gcm', label: 'aes-128-gcm' },
                      { value: 'chacha20-poly1305', label: 'chacha20-poly1305' },
                      { value: 'none', label: 'none' }
                    ],
                    setVmessSecurity
                  )}
                </>
              )}

              {isShadowsocks && (
                <>
                  <div className="simple-editor-field-divider" />
                  {renderSelect(
                    'method',
                    t('simpleEditor.method'),
                    method,
                    [
                      'aes-128-gcm', 'aes-256-gcm', 'chacha20-poly1305',
                      '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm',
                      '2022-blake3-chacha20-poly1305'
                    ].map(m => ({ value: m, label: m })),
                    setMethod
                  )}
                </>
              )}
            </div>
          </div>


          {isWireGuard && (
            <div className="simple-editor-section">
              <div className="simple-editor-section-title">
                <Lock size={14} />
                <span>WireGuard</span>
              </div>
              <div className="simple-editor-group">
                {renderTextField(t('simpleEditor.peerPublicKey'), peerPublicKey, setPeerPublicKey)}
                <div className="simple-editor-field-divider" />
                {renderTextField(t('simpleEditor.localAddress'), localAddress, setLocalAddress, '10.7.0.2/32')}
                <div className="simple-editor-field-divider" />
                {renderTextField(t('simpleEditor.presharedKey'), presharedKey, setPresharedKey)}
                <div className="simple-editor-field-divider" />
                {renderTextField(t('simpleEditor.mtu'), mtu, setMtu, '1420')}
              </div>
            </div>
          )}


          {isTuic && (
            <div className="simple-editor-section">
              <div className="simple-editor-section-title">
                <Gauge size={14} />
                <span>TUIC</span>
              </div>
              <div className="simple-editor-group">
                {renderSelect(
                  'congestionControl',
                  t('simpleEditor.congestionControl'),
                  congestionControl,
                  [
                    { value: 'bbr', label: 'BBR' },
                    { value: 'cubic', label: 'Cubic' },
                    { value: 'new_reno', label: 'New Reno' }
                  ],
                  setCongestionControl
                )}
                <div className="simple-editor-field-divider" />
                {renderSelect(
                  'udpRelayMode',
                  t('simpleEditor.udpRelayMode'),
                  udpRelayMode,
                  [
                    { value: 'native', label: 'Native' },
                    { value: 'quic', label: 'QUIC' }
                  ],
                  setUdpRelayMode
                )}
              </div>
            </div>
          )}


          {!isWireGuard && (
            <div className="simple-editor-section">
              <div className="simple-editor-section-title">
                <Shield size={14} />
                <span>{t('simpleEditor.tls')}</span>
              </div>
              <div className="simple-editor-group">
                {renderSwitchField(t('simpleEditor.enableTls'), isTls, setIsTls)}

                {isTls && (
                  <>
                    {isRealitySupported && (
                      <>
                        <div className="simple-editor-field-divider" />
                        {renderSelect(
                          'tlsType',
                          t('simpleEditor.tlsType'),
                          tlsType,
                          [
                            { value: 'TLS', label: 'TLS' },
                            { value: 'Reality', label: 'Reality' }
                          ],
                          setTlsType
                        )}
                      </>
                    )}

                    {tlsType === 'TLS' && (
                      <>
                        <div className="simple-editor-field-divider" />
                        {renderSelect(
                          'insecure',
                          t('simpleEditor.allowInsecure'),
                          insecure ? 'yes' : 'no',
                          [
                            { value: 'yes', label: t('simpleEditor.optionYes') },
                            { value: 'no', label: t('simpleEditor.optionNo') }
                          ],
                          v => setInsecure(v === 'yes')
                        )}
                      </>
                    )}

                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.sni'), sni, setSni)}

                    {!isShadowsocks && (
                      <>
                        <div className="simple-editor-field-divider" />
                        {renderTextField(t('simpleEditor.alpn'), alpn, setAlpn, 'h2,http/1.1')}
                      </>
                    )}

                    {isHysteria && (
                      <>
                        <div className="simple-editor-field-divider" />
                        {renderSwitchField(t('simpleEditor.allowInsecure'), insecure, setInsecure)}
                        <div className="simple-editor-field-divider" />
                        {renderTextField(t('simpleEditor.certPin'), pin, setPin, 'SHA-256 fingerprint')}
                      </>
                    )}

                    {!isHysteria && !isShadowsocks && !isTuic && (
                      <>
                        <div className="simple-editor-field-divider" />
                        {renderSelect(
                          'fingerprint',
                          t('simpleEditor.fingerprint'),
                          fingerprint,
                          [
                            'chrome', 'firefox', 'safari', 'edge',
                            'ios', 'android', 'random', 'randomized'
                          ].map(f => ({ value: f, label: f })),
                          setFingerprint
                        )}
                      </>
                    )}

                    {isShadowsocks && ssNetwork === 'tcp' && (
                      <>
                        <div className="simple-editor-field-divider" />
                        {renderTextField(t('simpleEditor.shadowTlsPassword'), shadowTlsPassword, setShadowTlsPassword)}
                        <div className="simple-editor-field-divider" />
                        {renderSelect(
                          'shadowTlsVersion',
                          t('simpleEditor.shadowTlsVersion'),
                          shadowTlsVersion,
                          [
                            { value: '3', label: 'Version 3' },
                            { value: '2', label: 'Version 2' },
                            { value: '1', label: 'Version 1' }
                          ],
                          setShadowTlsVersion
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}


          {isShadowsocks && (
            <div className="simple-editor-section">
              <div className="simple-editor-section-title">
                <Network size={14} />
                <span>{t('simpleEditor.ssNetwork')}</span>
              </div>
              <div className="simple-editor-group">
                {renderSelect(
                  'ssNetwork',
                  t('simpleEditor.ssNetwork'),
                  ssNetwork.toUpperCase(),
                  [
                    { value: 'tcp', label: 'TCP' },
                    { value: 'ws', label: 'WebSocket (WS)' }
                  ],
                  setSsNetwork
                )}
                {ssNetwork === 'ws' && (
                  <>
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.ssWsPath'), ssWsPath, setSsWsPath, '/')}
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.ssWsHost'), ssWsHost, setSsWsHost, 'domain.com')}
                  </>
                )}
              </div>
            </div>
          )}


          {isTransportSupported && (
            <div className="simple-editor-section">
              <div className="simple-editor-section-title">
                <Network size={14} />
                <span>{t('simpleEditor.ssNetwork')}</span>
              </div>
              <div className="simple-editor-group">
                {renderSelect(
                  'transport',
                  t('simpleEditor.ssNetwork'),
                  transport,
                  ['tcp', 'raw', 'kcp', 'ws', 'httpupgrade', 'h2', 'http', 'quic', 'grpc', 'xhttp'].map(tr => ({ value: tr, label: tr })),
                  setTransport
                )}

                {(transport === 'tcp' || transport === 'raw') && (
                  <>
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.httpHost'), tcpHost, setTcpHost, 'domain.com')}
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.path'), tcpPath, setTcpPath, '/')}
                  </>
                )}

                {transport === 'kcp' && (
                  <>
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.httpHost'), tcpHost, setTcpHost, 'domain.com')}
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.path'), tcpPath, setTcpPath, '/')}
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.kcpSeed'), kcpSeed, setKcpSeed)}
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.mtu'), kcpMtu, setKcpMtu, '1350')}
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.tti'), kcpTti, setKcpTti, '50')}
                  </>
                )}

                {transport === 'ws' && (
                  <>
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.ssWsHost'), wsHost, setWsHost, 'domain.com')}
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.ssWsPath'), wsPath, setWsPath, '/')}
                  </>
                )}

                {transport === 'httpupgrade' && (
                  <>
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.httpUpgradeHost'), httpUpgradeHost, setHttpUpgradeHost, 'domain.com')}
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.httpUpgradePath'), httpUpgradePath, setHttpUpgradePath, '/')}
                  </>
                )}

                {(transport === 'h2' || transport === 'http') && (
                  <>
                    <div className="simple-editor-field-divider" />
                    {renderTextField(transport === 'h2' ? t('simpleEditor.h2Host') : t('simpleEditor.httpHost'), h2Host, setH2Host, 'domain.com')}
                    <div className="simple-editor-field-divider" />
                    {renderTextField(transport === 'h2' ? t('simpleEditor.h2Path') : t('simpleEditor.path'), h2Path, setH2Path, '/')}
                  </>
                )}

                {transport === 'quic' && (
                  <>
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.quicSecurity'), quicSecurity, setQuicSecurity, 'none')}
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.quicKey'), quicKey, setQuicKey)}
                  </>
                )}

                {transport === 'grpc' && (
                  <>
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.grpcAuthority'), grpcAuthority, setGrpcAuthority, 'domain.com')}
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.grpcServiceName'), grpcServiceName, setGrpcServiceName)}
                  </>
                )}

                {transport === 'xhttp' && (
                  <>
                    <div className="simple-editor-field-divider" />
                    {renderSelect(
                      'xhttpMode',
                      t('simpleEditor.mode'),
                      xhttpMode,
                      ['auto', 'packet-up', 'packet-down'].map(m => ({ value: m, label: m })),
                      setXhttpMode
                    )}
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.host'), xhttpHost, setXhttpHost, 'domain.com')}
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.path'), xhttpPath, setXhttpPath, '/')}
                  </>
                )}
              </div>
            </div>
          )}


          {showReality && (
            <div className="simple-editor-section">
              <div className="simple-editor-section-title">
                <Eye size={14} />
                <span>{t('simpleEditor.reality')}</span>
              </div>
              <div className="simple-editor-group">
                {renderTextField(t('simpleEditor.pbk'), pbk, setPbk)}
                <div className="simple-editor-field-divider" />
                {renderTextField(t('simpleEditor.sid'), sid, setSid)}
              </div>
            </div>
          )}


          {isHysteria && (
            <div className="simple-editor-section">
              <div className="simple-editor-section-title">
                <Gauge size={14} />
                <span>{t('simpleEditor.hysteriaSettings')}</span>
              </div>
              <div className="simple-editor-group">
                {renderTextField(t('simpleEditor.upMbps'), upMbps, setUpMbps, 'e.g. 100')}
                <div className="simple-editor-field-divider" />
                {renderTextField(t('simpleEditor.downMbps'), downMbps, setDownMbps, 'e.g. 100')}

                {isHysteria2 && (
                  <>
                    <div className="simple-editor-field-divider" />
                    {renderSelect(
                      'obfsType',
                      t('simpleEditor.obfs'),
                      obfsType === '' ? 'None' : obfsType,
                      [
                        { value: 'None', label: 'None' },
                        { value: 'salamander', label: 'salamander' }
                      ],
                      v => setObfsType(v === 'None' ? '' : v)
                    )}

                    {obfsType === 'salamander' && (
                      <>
                        <div className="simple-editor-field-divider" />
                        {renderTextField(t('simpleEditor.obfsPass'), obfsPassword, setObfsPassword)}
                      </>
                    )}

                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.portHopping'), mport, setMport, 'e.g. 20000-50000')}
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.hopInterval'), hopInterval, setHopInterval, 'e.g. 10s or 5s')}
                  </>
                )}

                {!isHysteria2 && (
                  <>
                    <div className="simple-editor-field-divider" />
                    {renderTextField(t('simpleEditor.obfs'), obfsType, setObfsType, 'XOR Key')}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
