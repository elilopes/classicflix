
import React from 'react';
import { X, BookOpen, CheckCircle, ExternalLink, HelpCircle } from 'lucide-react';

interface WikidataGuideModalProps {
  onClose: () => void;
}

export const WikidataGuideModal: React.FC<WikidataGuideModalProps> = ({ onClose }) => {
  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1200 }}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content bg-dark border-info shadow-lg">
          <div className="modal-header border-info bg-info bg-opacity-10">
            <h5 className="modal-title text-info d-flex align-items-center gap-2">
              <HelpCircle size={20} /> Guia Rápido: Como usar no Wikidata
            </h5>
            <button className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4 text-white-50 small custom-scrollbar">
            <div className="d-flex flex-column gap-4">
              
              <div className="d-flex gap-3">
                <div className="flex-shrink-0 bg-info bg-opacity-20 text-info rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>1</div>
                <div>
                  <h6 className="text-white mb-1">Acesse o Wikidata</h6>
                  <p>Faça login em sua conta no <a href="https://www.wikidata.org" target="_blank" className="text-info">Wikidata.org</a>. Se não tiver uma, você pode criar rapidamente.</p>
                </div>
              </div>

              <div className="d-flex gap-3">
                <div className="flex-shrink-0 bg-info bg-opacity-20 text-info rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>2</div>
                <div>
                  <h6 className="text-white mb-1">Inicie um Novo Item</h6>
                  <p>No menu lateral, clique em <strong>"Criar um novo item"</strong> ou use o botão azul na tela anterior.</p>
                </div>
              </div>

              <div className="d-flex gap-3">
                <div className="flex-shrink-0 bg-info bg-opacity-20 text-info rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>3</div>
                <div>
                  <h6 className="text-white mb-1">Cole os Rótulos e Descrições</h6>
                  <p>Use o botão de copiar <span className="text-info">"Copiar"</span> do nosso assistente e cole nos campos correspondentes (Português e Inglês).</p>
                </div>
              </div>

              <div className="d-flex gap-3">
                <div className="flex-shrink-0 bg-info bg-opacity-20 text-info rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>4</div>
                <div>
                  <h6 className="text-white mb-1">Adicione Declarações (Statements)</h6>
                  <p>Após criar o item, clique em <strong>"adicionar declaração"</strong>. Digite o código da propriedade (ex: P31) e cole o valor sugerido.</p>
                  <ul className="mt-2 opacity-75">
                    <li><strong>P31:</strong> Instância de (Filme)</li>
                    <li><strong>P57:</strong> Diretor</li>
                    <li><strong>P577:</strong> Data de publicação</li>
                  </ul>
                </div>
              </div>

              <div className="d-flex gap-3">
                <div className="flex-shrink-0 bg-info bg-opacity-20 text-info rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>5</div>
                <div>
                  <h6 className="text-white mb-1">Publique e Vincule</h6>
                  <p>Clique em publicar. Uma vez criado, você terá um novo <strong>QID</strong> (ex: Q123456). Você pode então atualizar o filme no ClassicFlix com este ID oficial!</p>
                </div>
              </div>

            </div>

            <div className="mt-4 p-3 bg-white bg-opacity-5 rounded border border-secondary">
              <p className="mb-0 xsmall d-flex align-items-center gap-2">
                <CheckCircle size={14} className="text-success" /> 
                Dica: Adicionar referências (como o link do Archive.org) aumenta a confiabilidade do seu item no Wikidata.
              </p>
            </div>
          </div>
          <div className="modal-footer border-info bg-black bg-opacity-50">
            <button className="btn btn-info text-white fw-bold w-100" onClick={onClose}>
              Entendi, vamos lá!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
