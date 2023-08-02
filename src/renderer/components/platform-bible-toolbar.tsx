import { Toolbar, RefSelector, ScriptureReference } from 'papi-components';
// import standardMenuLayout from './platform-bible-menu.data';
import { HandleMenuCommand } from './platform-bible-menu.commands';
import { HandleMenuData } from './platform-bible-menu.data';
import './platform-bible-toolbar.css';

export default function PlatformBibleToolbar(props: {
  scrRef: ScriptureReference;
  referenceChanged: (scrRef: ScriptureReference) => void;
}) {
  const { referenceChanged } = props;
  const { scrRef } = props;

  return (
    <Toolbar className="toolbar" dataHandler={HandleMenuData} commandHandler={HandleMenuCommand}>
      <RefSelector handleSubmit={referenceChanged} scrRef={scrRef} />
    </Toolbar>
  );
}
