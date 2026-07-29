import { useState } from 'react';
import { Clipboard, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import './ClipboardButton.css';

interface ClipboardButtonProps {
  visible: boolean;
}

export default function ClipboardButton({ visible }: ClipboardButtonProps) {
  const { t } = useTranslation();
  const addSubscription = useAppStore((state) => state.addSubscription);
  const appendProfilesToSubscription = useAppStore((state) => state.appendProfilesToSubscription);
  const addNotification = useAppStore((state) => state.addNotification);
  const [isLoading, setIsLoading] = useState(false);

  const handleClipboardImport = async () => {
    try {
      setIsLoading(true);
      const text = await readText();
      if (!text) {
        setIsLoading(false);
        return;
      }


      const parseResult: any = await invoke('parse_clipboard', { text });
      
      if (parseResult && parseResult.profiles && parseResult.profiles.length > 0) {
        const isUrl = text.trim().startsWith('http://') || text.trim().startsWith('https://');
        const profiles = parseResult.profiles;
        
        if (!isUrl) {
          const serverListName = t('clipboard.serverList');
          const subscriptions = useAppStore.getState().subscriptions;
          const existingVirtualSub = subscriptions.find(s => s.name === serverListName && s.urlOrBase64 === 'clipboard');
          
          const newProfiles = profiles.map((p: any) => ({ 
            id: crypto.randomUUID(), 
            name: p.name,
            uri: p.uri,
            protocol: p.protocol,
            serverDescription: p.server_description,
            config_json: p.config_json
          }));

          if (existingVirtualSub) {
             appendProfilesToSubscription(existingVirtualSub.id, newProfiles);
             addNotification('success', t('clipboard.success', { name: serverListName }), 5);
          } else {
            const subId = Date.now().toString();
            const subscription = {
              id: subId,
              name: serverListName,
              urlOrBase64: 'clipboard',
              profiles: newProfiles,
              upload: parseResult.upload,
              download: parseResult.download,
              total: parseResult.total,
              expire: parseResult.expire,
              updateInterval: parseResult.update_interval ? parseResult.update_interval * 1000 : 0,
              description: parseResult.description || '',
              supportUrl: parseResult.support_url || '',
              webPageUrl: parseResult.web_page_url || '',
            };
            addSubscription(subscription);
            addNotification('success', t('clipboard.success', { name: serverListName }), 5);
          }
          return;
        }

        let name = parseResult.name;
        
        if (!name || name === 'Imported Profiles' || name === 'URI Profile') {
          try {
            const urlObj = new URL(text.trim());
            name = urlObj.hostname;
          } catch (e) {
            name = text.trim();
          }
        }

        const subId = Date.now().toString();
        const subscription = {
          id: subId,
          name,
          urlOrBase64: text.trim(),
          profiles: profiles.map((p: any, i: number) => ({ 
            id: `${subId}-${i}`, 
            name: p.name,
            uri: p.uri,
            protocol: p.protocol,
            serverDescription: p.server_description,
            config_json: p.config_json
          })),
          upload: parseResult.upload,
          download: parseResult.download,
          total: parseResult.total,
          expire: parseResult.expire,
          updateInterval: parseResult.update_interval ? parseResult.update_interval * 1000 : 0,
          description: parseResult.description || '',
          supportUrl: parseResult.support_url || '',
          webPageUrl: parseResult.web_page_url || '',
        };

        addSubscription(subscription);
        addNotification('success', t('clipboard.success', { name }), 5);
      } else {
         addNotification('error', t('clipboard.errorParse'), 5);
      }
    } catch (e: any) {
      console.error('Failed to parse clipboard', e);
      addNotification('error', t('clipboard.errorAdd', { error: e.toString() }), 5);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`clipboard-container ${visible ? 'visible' : 'hidden'}`}>
      <button className="clipboard-button" onClick={handleClipboardImport} disabled={isLoading}>
        {isLoading ? (
          <Loader2 size={20} className="clipboard-icon spinner" />
        ) : (
          <>
            <Clipboard size={20} className="clipboard-icon" />
            <span className="clipboard-text">{t('clipboard.button')}</span>
          </>
        )}
      </button>
    </div>
  );
}
