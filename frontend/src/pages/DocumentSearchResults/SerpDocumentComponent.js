import React, { useState } from "react";
import styles from "./ContentListings.module.css";
import {
    FaLockOpen,
    FaBookOpenReader,
    FaLink,
    FaArrowUpRightFromSquare,
    FaAngleRight,
} from "react-icons/fa6";
import { formatDocType } from "../../utils/formatDocType";

// Define the helper function before using it in the component
const buildFullDisplayUrl = (doc) => {
    const baseUrl =
        "https://casls-regina.primo.exlibrisgroup.com/discovery/fulldisplay?";
    const docid = doc.pnx.control.recordid[0];
    const context = doc.context; // e.g., "L"
    const vid = "01CASLS_REGINA:01CASLS_REGINA";
    const lang = "en";
    const search_scope = "MyInst_and_CI";
    const adaptor = doc.adaptor; // e.g., "Local Search Engine"
    const tab = "Everything";
    const query = "any,contains,data";
    const mode = "Basic";
    return `${baseUrl}docid=${docid}&context=${context}&vid=${vid}&lang=${lang}&search_scope=${search_scope}&adaptor=${encodeURIComponent(
        adaptor
    )}&tab=${tab}&query=${query}&mode=${mode}`;
};

// Archival badge palette — mirrors the approved design's type coloring
// (amber=books, sky=ebooks, emerald=journals, violet=theses, rose=reports).
const getTypeBadgeClasses = (rawType) => {
    const type = (Array.isArray(rawType) ? rawType[0] : rawType || "").toLowerCase();
    if (type.includes("ebook") || type.includes("e-book")) return "bg-sky-400 text-sky-950";
    if (type.includes("journal") || type.includes("article")) return "bg-emerald-400 text-emerald-950";
    if (type.includes("thesis") || type.includes("dissertation")) return "bg-violet-400 text-violet-950";
    if (type.includes("report")) return "bg-rose-400 text-rose-950";
    return "bg-amber-400 text-amber-950"; // books + default
};

function SERPDocumentComponent({ doc, onDocDragStart, onViewDocument }) {
    const [isReadMore, setIsReadMore] = useState(true);

    const readMoreHandler = (id) => {
        setIsReadMore(!isReadMore);
    };

    const fullDisplayUrl = buildFullDisplayUrl(doc);
    return (
        <div className="pl-5 w-full">
            <div className="flex items-center mb-1.5">
                <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold uppercase tracking-wide ${getTypeBadgeClasses(doc.pnx.display.type)}`}>
                    {formatDocType(doc.pnx.display.type)}
                </span>
                {(doc.pnx.display.creationdate !== undefined ||
                    doc.pnx.facets.creationdate !== undefined) && (
                    <span className="text-ink-muted text-xs font-mono ml-2.5">
                        {doc.pnx.display.creationdate !== undefined
                            ? doc.pnx.display.creationdate
                            : doc.pnx.facets.creationdate}
                    </span>
                )}
                {doc.pnx.display.ispartof !== undefined && (
                    <span className="text-ink-muted text-xs font-mono ml-2.5 truncate">
                        {doc.pnx.display.ispartof}
                    </span>
                )}
            </div>
            {/* Document Title wrapped in a clickable link */}
            <h3
                className="font-serif text-[16px] font-medium text-ink leading-snug cursor-grab active:cursor-grabbing hover:text-navy transition-colors"
                id={"document-title-serp"}
                draggable
                onDragStart={(event) => onDocDragStart?.(event, doc)}
            >
                <a href={fullDisplayUrl} target="_blank" rel="noopener noreferrer" onClick={() => onViewDocument?.(doc)}>
                    {doc.pnx.display.title[0]}
                </a>
            </h3>
            <p className="mb-1.5 italic text-ink-muted text-sm">
                {doc.pnx.addata?.au !== undefined ? (
                    <>
                        {doc.pnx.addata.au.map((author, index) => (
                            <span key={index}>
                {author.replace(".", "").split(",")}{" "}
                                {doc.pnx.addata.au.length - 1 !== index && <span>,</span>}{" "}
              </span>
                        ))}
                    </>
                ) : (
                    <>
                        {doc.pnx.addata?.addau !== undefined ? (
                            <>
                                {doc.pnx.addata.addau.map((author, index) => (
                                    <span key={index}>
                    {author.replace(".", "").split(",")}{" "}
                                        {doc.pnx.addata.addau.length - 1 !== index && <span>,</span>}{" "}
                  </span>
                                ))}
                            </>
                        ) : (
                            <>
                                {doc.pnx.addata?.contributor !== undefined && (
                                    <>
                                        {doc.pnx.addata.contributor.map((author, index) => (
                                            <span key={index}>
                        {author.replace(".", "").split(",")}{" "}
                                                {doc.pnx.addata.addau.length - 1 !== index && <span>,</span>}{" "}
                      </span>
                                        ))}
                                    </>
                                )}
                            </>
                        )}
                    </>
                )}
            </p>
            {doc.pnx.addata?.abstract !== undefined && (
                <>
                    {doc.pnx.addata.abstract[0].length > 250 ? (
                        <>
                            {isReadMore ? (
                                <p className={`mb-3 text-justify text-sm leading-relaxed ${styles.abstract_txt}`}>
                                    {doc.pnx.addata.abstract[0].slice(0, 250) + `...`}
                                    <span
                                        onClick={() =>
                                            readMoreHandler(doc.pnx.control.recordid[0])
                                        }
                                        className="text-sm text-accent hover:underline cursor-pointer transition ease-out font-medium"
                                    >
                    {" "}
                                        Read more
                  </span>
                                </p>
                            ) : (
                                <p className={`mb-3 text-justify text-sm leading-relaxed ${styles.abstract_txt}`}>
                                    {doc.pnx.addata.abstract[0]}
                                    <span
                                        onClick={() =>
                                            readMoreHandler(doc.pnx.control.recordid[0])
                                        }
                                        className="text-sm text-accent hover:underline cursor-pointer transition ease-out font-medium"
                                    >
                    {" "}
                                        Read less
                  </span>
                                </p>
                            )}
                        </>
                    ) : (
                        <p className={`mb-3 text-justify text-sm leading-relaxed ${styles.abstract_txt}`}>
                            {doc.pnx.addata.abstract[0]}
                        </p>
                    )}
                </>
            )}
            <div className="mt-1">
                <div className="flex items-center">
                    {doc.pnx.display?.lds50 !== undefined && (
                        <>
                            {doc.pnx.display.lds50.map((peerReviewData, index) => (
                                <div key={index} className="flex items-center mr-3">
                                    {peerReviewData === "peer_reviewed" && (
                                        <>
                                            <FaBookOpenReader className="text-xs text-agent-clio" />
                                            <p className="uppercase text-[11px] font-mono text-ink-muted ml-1">Peer Reviewed</p>
                                        </>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                    {doc.pnx.addata?.oa !== undefined && (
                        <>
                            {doc.pnx.addata.oa.map((data, index) => (
                                <div key={index} className="flex items-center">
                                    {data === "free_for_read" && (
                                        <>
                                            <FaLockOpen className="text-xs text-agent-hermes" />
                                            <p className="uppercase text-[11px] font-mono text-ink-muted ml-1">Open Access</p>
                                        </>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
            {doc.delivery?.availability !== undefined && (
                <>
                    {doc.delivery.availability.map((fulltextData, index) => (
                        <div key={index} className="flex items-center">
                            {fulltextData === "fulltext" && (
                                <>
                                    <FaLink className="text-xs text-ink-muted" />
                                    <p className="uppercase text-[11px] font-mono m-1 text-navy">
                                        Full text available
                                    </p>
                                    <FaArrowUpRightFromSquare className="text-xs text-ink-muted ml-1" />
                                    <FaAngleRight className="text-xs text-ink-muted ml-1" />
                                </>
                            )}
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

export default SERPDocumentComponent;
