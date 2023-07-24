import { useCallback, useEffect, useState } from 'react';
import { Menu, Dropdown } from 'antd';
import { FolderIcon, DocumentPlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { menuIndexeddbStorage } from '@renderer/store/menuIndexeddb';
import type {
  RevenoteFile,
  RevenoteFileType,
  RevenoteFolder,
  FileTreeItem
} from '@renderer/types/file';
import {
  getOpenKeysFromLocal,
  getSelectedKeysFromLocal,
  setCurrentFileIdToLocal,
  setOpenKeysToLocal,
  setSelectedKeysToLocal
} from '@renderer/store/localstorage';
import { useAtom } from 'jotai';
import {
  currentFileIdAtom,
  currentFileAtom,
  folderListAtom,
  fileTreeAtom
} from '@renderer/store/jotai';
import EditableText from '../EditableText';
import { blocksuiteStorage } from '@renderer/store/blocksuite';
import useBlocksuitePageTitle from '@renderer/hooks/useBlocksuitePageTitle';
import { useDebounceEffect } from 'ahooks';
import { FILE_ID_REGEX } from '@renderer/utils/constant';

import './index.css';

interface Props {
  collapsed: boolean;
}

export default function CustomMenu({ collapsed }: Props) {
  // const [folderList, setFolderList] = useAtom(folderListAtom);
  // const [filesInFolder, setFilesInFolder] = useState<RevenoteFile[]>();
  const [openKeys, setOpenKeys] = useState<string[]>(getOpenKeysFromLocal());
  const [selectedKeys, setSelectedKeys] = useState<string[]>(getSelectedKeysFromLocal());
  const [currentFileId, setCurrentFileId] = useAtom(currentFileIdAtom);
  const [currentFile, setCurrentFile] = useAtom(currentFileAtom);
  const [pageTitle] = useBlocksuitePageTitle();
  const [currentFolderId, setCurrentFolderId] = useState<string>();
  const [fileTree, setFileTree] = useAtom(fileTreeAtom);

  const getFileTree = useCallback(async () => {
    const tree = await menuIndexeddbStorage.getFileTree();
    setFileTree(tree);
    return tree;
  }, []);

  const getCurrentFolderId = useCallback((folders) => {
    let currentFolderId: string | undefined = openKeys?.filter(
      (key) => !!folders?.find((folder) => folder.id === key)
    )?.[0];

    if (!currentFolderId) {
      currentFolderId = folders?.[0]?.id;
    }

    return currentFolderId;
  }, []);

  // const getFolders = useCallback(async () => {
  //   const folders = await menuIndexeddbStorage.getFolders();
  //   setFolderList(folders || []);

  //   const currentFolderId = getCurrentFolderId(folders);

  //   if (currentFolderId) {
  //     getFilesInFolder(currentFolderId);
  //     setOpenKeys([currentFolderId]);
  //   }
  // }, [menuIndexeddbStorage]);

  // const getFilesInFolder = useCallback(async (folderId: string) => {
  //   if (!folderId) {
  //     return;
  //   }

  //   const filesInFolder = await menuIndexeddbStorage.getFilesInFolder(folderId);

  //   setFilesInFolder(filesInFolder);

  //   const currentFile = filesInFolder?.[0];

  //   if (!currentFile) {
  //     return;
  //   }

  //   return filesInFolder;
  // }, []);

  useEffect(() => {
    !collapsed && getFileTree();
  }, [menuIndexeddbStorage, collapsed]);

  useEffect(() => {
    setSelectedKeysToLocal(selectedKeys);
  }, [selectedKeys]);

  useEffect(() => {
    setCurrentFolderId(openKeys?.[0]);
  }, [openKeys?.[0]]);

  useEffect(() => {
    const files = fileTree.reduce(
      (prev, item) => [...prev, ...item.children],
      [] as RevenoteFile[]
    );
    const file =
      (currentFileId && files?.find((_file) => _file.id === currentFileId)) || files?.[0];

    console.log('--- file ---', file, currentFileId, files);

    setCurrentFile(file);
    file && setSelectedKeys([`${file.id}______${file.name}`]);
  }, [currentFileId, fileTree]);

  useEffect(() => {
    if (currentFileId) {
      setCurrentFileIdToLocal(currentFileId);
    }
  }, [currentFileId]);

  const updateFileNameInMenu = useCallback(async () => {
    if (!currentFile || pageTitle === undefined || currentFile.name === pageTitle) {
      return;
    }
    await menuIndexeddbStorage.updateFileName(currentFile, pageTitle);
    await getFileTree();
    setSelectedKeys([`${currentFile.id}______${pageTitle}`]);
  }, [pageTitle, currentFile, currentFolderId]);

  useDebounceEffect(
    () => {
      updateFileNameInMenu();
    },
    [pageTitle, currentFile, currentFolderId],
    {
      wait: 200
    }
  );

  const addFile = useCallback(
    async (folderId: string, type: RevenoteFileType) => {
      const file = await menuIndexeddbStorage.addFile(folderId, type);
      await getFileTree();
      setCurrentFileId(file.id);
    },
    [menuIndexeddbStorage]
  );

  const deleteFile = useCallback(
    async (fileId: string, folderId: string) => {
      await menuIndexeddbStorage.deleteFile(fileId);
      await blocksuiteStorage.deletePage(fileId);

      const tree = await getFileTree();

      console.log('currentFileId', currentFileId, fileId);

      // reset current file when current file is removed
      if (currentFileId === fileId) {
        const filesInFolder = tree.find((folder) => folder.id === folderId)?.children;

        setCurrentFileId(filesInFolder?.[0]?.id);
      }
    },
    [menuIndexeddbStorage]
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      await menuIndexeddbStorage.deleteFolder(folderId);
      const tree = await getFileTree();
      setCurrentFolderId(tree?.[0]?.id);
    },
    [menuIndexeddbStorage]
  );

  const onOpenChange = useCallback((keys) => {
    setOpenKeys(keys);
    setOpenKeysToLocal(keys);
  }, []);

  const onSelect = useCallback(({ key }) => {
    const fileId = key?.match(FILE_ID_REGEX)?.[1];
    setCurrentFileId(fileId);
  }, []);

  const getFolderMenu = useCallback(
    (folder: RevenoteFolder) => [
      {
        key: 'rename',
        label: 'rename',
        onClick: () => {
          console.log('rename');
        }
      },
      {
        key: 'delete',
        label: 'delete',
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          deleteFolder(folder.id);
        }
      }
    ],
    []
  );

  const getAddFileMenu = useCallback(
    (folder) => [
      {
        key: 'markdown',
        label: 'Markdown',
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          addFile(folder.id, 'markdown');
        }
      },
      {
        key: 'canvas',
        label: 'Canvas',
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          addFile(folder.id, 'canvas');
        }
      }
    ],
    []
  );

  const getFileMenu = useCallback(
    (file, folder) => [
      {
        key: 'rename',
        label: 'rename',
        onClick: () => {
          console.log('rename');
        }
      },
      {
        key: 'delete',
        label: (
          <div className="flex items-center justify-between">
            <TrashIcon className="h-4 w-4" />
            <span className="ml-2">Delete</span>
          </div>
        ),
        onClick: () => {
          console.log('delete');
          deleteFile(file.id, folder.id);
        }
      }
    ],
    []
  );

  const onFileNameChange = useCallback((text: string, file: RevenoteFile) => {
    if (file.type === 'markdown') {
      blocksuiteStorage.updatePageTitle(file.id, text);
    }

    console.log('onFileNameChange', text);

    menuIndexeddbStorage.updateFileName(file, text);
  }, []);

  const onFolderNameChange = useCallback((folder: RevenoteFolder, text: string) => {
    menuIndexeddbStorage.updateFolderName(folder, text);
  }, []);

  return (
    <div className="revenote-menu-container">
      <Menu
        theme="light"
        mode="inline"
        selectedKeys={selectedKeys}
        openKeys={openKeys}
        onOpenChange={onOpenChange}
        onSelect={onSelect}
        style={{ border: 'none' }}
        items={fileTree?.map((folder) => ({
          key: folder.id,
          icon: <FolderIcon className="h-4 w-4" />,
          label: (
            <Dropdown menu={{ items: getFolderMenu(folder) }} trigger={['contextMenu']}>
              <div className="flex items-center justify-between">
                <EditableText
                  text={folder.name}
                  defaultText="Untitled"
                  onChange={(text) => onFolderNameChange(folder, text)}
                />
                <Dropdown menu={{ items: getAddFileMenu(folder) }}>
                  <DocumentPlusIcon
                    className="h-4 w-4 text-current cursor-pointer mr-4 menu-icon"
                    onClick={(e) => e.stopPropagation()}
                  />
                </Dropdown>
              </div>
            </Dropdown>
          ),
          children: folder?.children?.map((file) => {
            return {
              key: `${file.id}______${file.name}`,
              label: (
                <Dropdown menu={{ items: getFileMenu(file, folder) }} trigger={['contextMenu']}>
                  <div className="flex items-center justify-between">
                    <EditableText
                      type={file.type}
                      text={file.name}
                      defaultText="Untitled"
                      onChange={(text) => onFileNameChange(text, file)}
                    />
                  </div>
                </Dropdown>
              )
            };
          })
        }))}
      />
    </div>
  );
}
