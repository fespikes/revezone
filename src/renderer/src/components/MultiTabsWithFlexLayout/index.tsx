import { IJsonModel, Layout, Model } from 'flexlayout-react';
import type { Action } from 'flexlayout-react';
import 'flexlayout-react/style/light.css';
import NoteEditor from '@renderer/components/NoteEditor';
import RevedrawApp from '../RevedrawApp';
import WelcomePage from '../WelcomePage';
import { useCallback, useEffect, useState } from 'react';
import useTabList from '@renderer/hooks/useTabList';

import './index.css';
import { currentFileAtom } from '@renderer/store/jotai';
import { useAtom } from 'jotai';
import { setTabIndexToLocal } from '@renderer/store/localstorage';
import useCurrentFile from '@renderer/hooks/useCurrentFile';
import { fileTreeIndexeddbStorage } from '@renderer/store/fileTreeIndexeddb';
import { TabItem } from '@renderer/types/tabs';
import { siderbarCollapsedAtom } from '@renderer/store/jotai';

export default function MultiTabs() {
  const { tabIndex, tabList, deleteTab, setTabIndex } = useTabList();
  const [model, setModel] = useState<Model>();
  const [currentFile] = useAtom(currentFileAtom);
  const { updateCurrentFile } = useCurrentFile();
  const [collapsed] = useAtom(siderbarCollapsedAtom);

  useEffect(() => {
    console.log('--- tablist ---', tabIndex, tabList);

    const json: IJsonModel = {
      global: {},
      layout: {
        type: 'row',
        weight: 100,
        children: [
          {
            type: 'tabset',
            weight: 10,
            selected: tabIndex,
            children: tabList
          }
        ]
      }
    };

    const _model = Model.fromJson(json);

    setModel(_model);
  }, [tabIndex, tabList]);

  const renderContent = useCallback((file, currentFile) => {
    // if (file?.id !== currentFile?.id) return;

    // console.log('--- renderContent ---', file);

    switch (file?.type) {
      case 'note':
        return <NoteEditor file={file} />;
      case 'board':
        return <RevedrawApp file={file} />;
      default:
        return <WelcomePage />;
    }
  }, []);

  const factory = useCallback(
    (node) => {
      const file = node.getConfig();

      return <div className="tab_content">{renderContent(file, currentFile)}</div>;
    },
    [currentFile]
  );

  const onTabDelete = useCallback((fileId: string, tabList, tabIndex) => {
    deleteTab(fileId, tabList, tabIndex);
  }, []);

  const onTabSelect = useCallback(async (fileId: string, tabList: TabItem[]) => {
    const _tabIndex = tabList.findIndex((tab) => tab.id === fileId);

    setTabIndex(_tabIndex);
    setTabIndexToLocal(_tabIndex);

    console.log('--- onTabSelect ---', fileId, _tabIndex, tabList);

    const file = fileId ? await fileTreeIndexeddbStorage.getFile(fileId) : undefined;

    updateCurrentFile(file);
  }, []);

  const onAction = useCallback(
    (action: Action) => {
      console.log('--- onAction ---', action);

      switch (action.type) {
        case 'FlexLayout_DeleteTab':
          onTabDelete(action.data.node, tabList, tabIndex);
          break;
        case 'FlexLayout_SelectTab':
          onTabSelect(action.data.tabNode, tabList);
          break;
      }
      return action;
    },
    [tabList, tabIndex]
  );

  return model ? (
    <div className={`${collapsed ? 'revezone-siderbar-collapsed' : ''}`}>
      <Layout model={model} factory={factory} onAction={onAction} />
    </div>
  ) : null;
}
