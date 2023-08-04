import { Toolbar, RefSelector, ScriptureReference } from 'papi-components';
import { HandleMenuCommand } from './platform-bible-menu.commands';
import { HandleMenuData } from './platform-bible-menu.data';
import './platform-bible-toolbar.css';

export default function PlatformBibleToolbar(props: {
  scrRef: ScriptureReference;
  referenceChanged: (scrRef: ScriptureReference) => void;
}) {
  const { referenceChanged, scrRef } = props;

  return (
    <Toolbar className="toolbar" dataHandler={HandleMenuData} commandHandler={HandleMenuCommand}>
      <RefSelector handleSubmit={referenceChanged} scrRef={scrRef} />
    </Toolbar>
  );
}
